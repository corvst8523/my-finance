"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Entry, EntryChange, Item, MutationResult } from "@/lib/types";
import { categorySchema, itemSchema } from "@/lib/validation";

const itemTable = "items";
const itemSelect = "id,user_id,category_id,parent_id,code,name";
const itemSelectWithType = `${itemSelect},type`;
const entrySelect = "id,user_id,item_id,month,value,note";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function upsertEntryValue(
  itemId: string,
  month: string,
  value: number,
): Promise<MutationResult<EntryChange>> {
  try {
    const { supabase, userId } = await requireUser();
    const item = await getOwnedItem(supabase, userId, itemId);

    if (!item) {
      return { ok: false, error: "Item nao encontrado." };
    }

    const existing = await findEntry(supabase, userId, itemId, month);

    if (value === 0) {
      if (existing) {
        const { error } = await supabase
          .from("entries")
          .delete()
          .eq("id", existing.id)
          .eq("user_id", userId);

        if (error) {
          return { ok: false, error: error.message };
        }
      }

      revalidateCashflowPaths();
      return { ok: true, data: { entry: null, itemId, month }, message: "Lancamento removido." };
    }

    const payload = { user_id: userId, item_id: itemId, month, value };
    const result = existing
      ? await supabase
          .from("entries")
          .update(payload)
          .eq("id", existing.id)
          .select(entrySelect)
          .single()
      : await supabase.from("entries").insert(payload).select(entrySelect).single();

    if (result.error || !result.data) {
      return { ok: false, error: result.error?.message ?? "Nao foi possivel salvar." };
    }

    revalidateCashflowPaths();
    return {
      ok: true,
      data: { entry: normalizeEntry(result.data), itemId, month },
      message: "Lancamento salvo.",
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateEntryNote(
  itemId: string,
  month: string,
  note: string,
): Promise<MutationResult<Entry>> {
  try {
    const { supabase, userId } = await requireUser();
    const item = await getOwnedItem(supabase, userId, itemId);

    if (!item) {
      return { ok: false, error: "Item nao encontrado." };
    }

    const existing = await findEntry(supabase, userId, itemId, month);
    const normalizedNote = note.trim() ? note : null;

    if (!existing && !normalizedNote) {
      return { ok: false, error: "Nao ha lancamento para atualizar." };
    }

    const result = existing
      ? await supabase
          .from("entries")
          .update({ note: normalizedNote })
          .eq("id", existing.id)
          .select(entrySelect)
          .single()
      : await supabase
          .from("entries")
          .insert({ user_id: userId, item_id: itemId, month, value: 0, note: normalizedNote })
          .select(entrySelect)
          .single();

    if (result.error || !result.data) {
      return { ok: false, error: result.error?.message ?? "Nao foi possivel salvar a nota." };
    }

    revalidatePath("/app/cashflow");
    return { ok: true, data: normalizeEntry(result.data), message: "Nota salva." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createCategoryAction(input: unknown): Promise<MutationResult<Category>> {
  try {
    const parsed = categorySchema.parse(input);
    const { supabase, userId } = await requireUser();
    const code = await nextTopLevelCode(supabase, userId);
    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, code, name: parsed.name, type: parsed.type })
      .select("id,user_id,code,name,type")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel criar a categoria." };
    }

    revalidateSetupPaths();
    return { ok: true, data: data as Category, message: "Categoria criada." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateCategoryAction(input: unknown): Promise<MutationResult<Category>> {
  try {
    const parsed = categorySchema.required({ id: true }).parse(input);
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("categories")
      .update({ name: parsed.name, type: parsed.type })
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select("id,user_id,code,name,type")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel atualizar a categoria." };
    }

    const { error: itemsError } = await supabase
      .from(itemTable)
      .update({ type: parsed.type })
      .eq("category_id", parsed.id)
      .eq("user_id", userId);

    if (itemsError) {
      return { ok: false, error: itemsError.message };
    }

    revalidateSetupPaths();
    return { ok: true, data: data as Category, message: "Categoria atualizada." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteCategoryAction(id: string): Promise<MutationResult<string>> {
  try {
    const { supabase, userId } = await requireUser();
    const { data: itemIds, error: itemsError } = await supabase
      .from(itemTable)
      .select("id")
      .eq("user_id", userId)
      .eq("category_id", id);

    if (itemsError) {
      return { ok: false, error: itemsError.message };
    }

    const ids = (itemIds ?? []).map((item) => item.id);

    if (ids.length > 0) {
      const { count, error: entriesError } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("item_id", ids)
        .neq("value", 0);

      if (entriesError) {
        return { ok: false, error: entriesError.message };
      }

      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error: `Categoria possui ${count} lancamento${count === 1 ? "" : "s"} vinculado${count === 1 ? "" : "s"}. Remova-os antes de excluir.`,
        };
      }

      const { error: deleteEntriesError } = await supabase
        .from("entries")
        .delete()
        .eq("user_id", userId)
        .in("item_id", ids);

      if (deleteEntriesError) {
        return { ok: false, error: deleteEntriesError.message };
      }

      const { error: deleteItemsError } = await supabase
        .from(itemTable)
        .delete()
        .eq("user_id", userId)
        .in("id", ids);

      if (deleteItemsError) {
        return { ok: false, error: deleteItemsError.message };
      }
    }

    const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidateSetupPaths();
    return { ok: true, data: id, message: "Categoria removida." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createAccountAction(input: unknown): Promise<MutationResult<Item>> {
  return createItemAction(input);
}

export async function updateAccountAction(input: unknown): Promise<MutationResult<Item>> {
  return updateItemAction(input);
}

export async function deleteAccountAction(id: string): Promise<MutationResult<string>> {
  return deleteItemAction(id);
}

export async function createItemAction(input: unknown): Promise<MutationResult<Item>> {
  try {
    const parsed = itemSchema.parse(input);
    const { supabase, userId } = await requireUser();
    const category = parsed.category_id
      ? await getOwnedCategory(supabase, userId, parsed.category_id)
      : null;

    if (parsed.category_id && !category) {
      return { ok: false, error: "Categoria nao encontrada." };
    }

    if (category && category.type !== parsed.type) {
      return { ok: false, error: "A categoria escolhida nao pertence ao tipo do item." };
    }

    const code = await nextItemCode(supabase, userId, parsed.category_id);
    const payload = {
      user_id: userId,
      code,
      name: parsed.name,
      category_id: parsed.category_id,
      type: parsed.type,
      parent_id: null,
    };
    const { data, error } = await supabase
      .from(itemTable)
      .insert(payload)
      .select(itemSelectWithType)
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel criar o item." };
    }

    revalidateSetupPaths();
    return { ok: true, data: normalizeItem(data), message: "Item criado." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateItemAction(input: unknown): Promise<MutationResult<Item>> {
  try {
    const parsed = itemSchema.required({ id: true }).parse(input);
    const { supabase, userId } = await requireUser();
    const existing = await getOwnedItem(supabase, userId, parsed.id);

    if (!existing) {
      return { ok: false, error: "Item nao encontrado." };
    }

    const category = parsed.category_id
      ? await getOwnedCategory(supabase, userId, parsed.category_id)
      : null;

    if (parsed.category_id && !category) {
      return { ok: false, error: "Categoria nao encontrada." };
    }

    if (category && category.type !== parsed.type) {
      return { ok: false, error: "A categoria escolhida nao pertence ao tipo do item." };
    }

    const placementChanged = (existing.category_id ?? null) !== parsed.category_id;
    const code = placementChanged
      ? await nextItemCode(supabase, userId, parsed.category_id)
      : existing.code;
    const payload = {
      code,
      name: parsed.name,
      category_id: parsed.category_id,
      type: parsed.type,
      parent_id: null,
    };
    const { data, error } = await supabase
      .from(itemTable)
      .update(payload)
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select(itemSelectWithType)
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel atualizar o item." };
    }

    revalidateSetupPaths();
    return { ok: true, data: normalizeItem(data), message: "Item atualizado." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteItemAction(id: string): Promise<MutationResult<string>> {
  try {
    const { supabase, userId } = await requireUser();
    const { error: entriesError } = await supabase
      .from("entries")
      .delete()
      .eq("item_id", id)
      .eq("user_id", userId);

    if (entriesError) {
      return { ok: false, error: entriesError.message };
    }

    const { error } = await supabase.from(itemTable).delete().eq("id", id).eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidateSetupPaths();
    return { ok: true, data: id, message: "Item removido." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

async function nextItemCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string | null,
) {
  if (!categoryId) {
    return nextTopLevelCode(supabase, userId);
  }

  const { data: category } = await supabase
    .from("categories")
    .select("code")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .maybeSingle();
  const parentCode = category?.code ?? "";

  const { data: items } = await supabase
    .from(itemTable)
    .select("code")
    .eq("user_id", userId)
    .eq("category_id", categoryId);

  const next = getNextCodePart(
    (items ?? []).map((item) => item.code),
    parentCode,
  );
  return parentCode ? `${parentCode}.${next}` : String(next);
}

async function nextTopLevelCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const [categoriesResult, itemsResult] = await Promise.all([
    supabase.from("categories").select("code").eq("user_id", userId),
    supabase.from(itemTable).select("code").eq("user_id", userId).is("category_id", null),
  ]);
  const codes = [
    ...(categoriesResult.data ?? []).map((category) => category.code),
    ...(itemsResult.data ?? []).map((item) => item.code),
  ];

  return String(getNextCodePart(codes));
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Sessao expirada. Entre novamente.");
  }

  return { supabase, userId: user.id };
}

async function getOwnedItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: string,
) {
  const { data, error } = await supabase
    .from(itemTable)
    .select(itemSelectWithType)
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  return error || !data ? null : normalizeItem(data as Item);
}

async function getOwnedCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
) {
  const { data, error } = await supabase
    .from("categories")
    .select("id,code,type")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .maybeSingle();

  return error ? null : data;
}

async function findEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: string,
  month: string,
) {
  const { data, error } = await supabase
    .from("entries")
    .select(entrySelect)
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("month", month)
    .maybeSingle();

  return error || !data ? null : normalizeEntry(data);
}

function normalizeEntry(entry: Entry): Entry {
  return {
    ...entry,
    value: Number(entry.value),
    note: entry.note ?? null,
  };
}

function normalizeItem(item: Item): Item {
  return {
    ...item,
    category_id: item.category_id ?? null,
    parent_id: item.parent_id ?? null,
  };
}

function getNextCodePart(codes: string[], parentCode?: string) {
  const numbers = codes
    .map((code) => {
      if (!parentCode) {
        return /^\d+$/.test(code) ? Number(code) : 0;
      }

      const prefix = `${parentCode}.`;
      if (!code.startsWith(prefix)) {
        return 0;
      }

      const suffix = code.slice(prefix.length);
      return /^\d+$/.test(suffix) ? Number(suffix) : 0;
    })
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...numbers) + 1;
}

function revalidateCashflowPaths() {
  revalidatePath("/app/cashflow");
  revalidatePath("/app/categories");
}

function revalidateSetupPaths() {
  revalidatePath("/app/setup");
  revalidatePath("/app/categories");
  revalidatePath("/app/cashflow");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado.";
}
