"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Account, Category, Entry, MutationResult } from "@/lib/types";
import { accountSchema, categorySchema } from "@/lib/validation";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function upsertEntryValue(
  accountId: string,
  month: string,
  value: number,
): Promise<MutationResult<Entry>> {
  try {
    const { supabase, userId } = await requireUser();
    const account = await getOwnedAccount(supabase, userId, accountId);

    if (!account) {
      return { ok: false, error: "Conta nao encontrada." };
    }

    const existing = await findEntry(supabase, userId, accountId, month);
    const payload = { user_id: userId, account_id: accountId, month, value };
    const result = existing
      ? await supabase.from("entries").update(payload).eq("id", existing.id).select(entrySelect).single()
      : await supabase.from("entries").insert(payload).select(entrySelect).single();

    if (result.error || !result.data) {
      return { ok: false, error: result.error?.message ?? "Nao foi possivel salvar." };
    }

    revalidatePath("/app/cashflow");
    return { ok: true, data: normalizeEntry(result.data), message: "Valor salvo." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateEntryNote(
  accountId: string,
  month: string,
  note: string,
): Promise<MutationResult<Entry>> {
  try {
    const { supabase, userId } = await requireUser();
    const account = await getOwnedAccount(supabase, userId, accountId);

    if (!account) {
      return { ok: false, error: "Conta nao encontrada." };
    }

    const existing = await findEntry(supabase, userId, accountId, month);
    const result = existing
      ? await supabase.from("entries").update({ note }).eq("id", existing.id).select(entrySelect).single()
      : await supabase
          .from("entries")
          .insert({ user_id: userId, account_id: accountId, month, value: 0, note })
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
    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", parsed.type);
    const code = String((count ?? 0) + 1);
    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, code, name: parsed.name, type: parsed.type })
      .select("id,user_id,code,name,type")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel criar a categoria." };
    }

    revalidatePath("/app/setup");
    revalidatePath("/app/categories");
    revalidatePath("/app/cashflow");
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

    revalidatePath("/app/setup");
    revalidatePath("/app/categories");
    revalidatePath("/app/cashflow");
    return { ok: true, data: data as Category, message: "Categoria atualizada." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteCategoryAction(id: string): Promise<MutationResult<string>> {
  try {
    const { supabase, userId } = await requireUser();
    const { data: accountIds, error: accountsError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("category_id", id);

    if (accountsError) {
      return { ok: false, error: accountsError.message };
    }

    const ids = (accountIds ?? []).map((account) => account.id);

    if (ids.length > 0) {
      const { count, error: entriesError } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("account_id", ids);

      if (entriesError) {
        return { ok: false, error: entriesError.message };
      }

      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error: `Categoria possui ${count} lançamento${count === 1 ? "" : "s"} vinculado${count === 1 ? "" : "s"}. Remova-os antes de excluir.`,
        };
      }
    }

    const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/app/setup");
    revalidatePath("/app/categories");
    revalidatePath("/app/cashflow");
    return { ok: true, data: id, message: "Categoria removida." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createAccountAction(input: unknown): Promise<MutationResult<Account>> {
  try {
    const parsed = accountSchema.parse(input);
    const { supabase, userId } = await requireUser();
    const code = await nextAccountCode(supabase, userId, parsed.category_id);
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        code,
        name: parsed.name,
        category_id: parsed.category_id,
        parent_id: null,
      })
      .select("id,user_id,category_id,parent_id,code,name")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel criar a conta." };
    }

    revalidatePath("/app/setup");
    revalidatePath("/app/cashflow");
    return { ok: true, data: data as Account, message: "Conta criada." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateAccountAction(input: unknown): Promise<MutationResult<Account>> {
  try {
    const parsed = accountSchema.required({ id: true }).parse(input);
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("accounts")
      .update({
        name: parsed.name,
        category_id: parsed.category_id,
        parent_id: null,
      })
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select("id,user_id,category_id,parent_id,code,name")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel atualizar a conta." };
    }

    revalidatePath("/app/setup");
    revalidatePath("/app/cashflow");
    return { ok: true, data: data as Account, message: "Conta atualizada." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteAccountAction(id: string): Promise<MutationResult<string>> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/app/setup");
    revalidatePath("/app/cashflow");
    return { ok: true, data: id, message: "Conta removida." };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

const entrySelect = "id,user_id,account_id,month,value,note";

async function nextAccountCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
) {
  let parentCode = "";

  const { data: category } = await supabase
    .from("categories")
    .select("code")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .maybeSingle();
  parentCode = category?.code ?? "";

  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("category_id", categoryId);

  const next = (count ?? 0) + 1;
  return parentCode ? `${parentCode}.${next}` : String(next);
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

async function getOwnedAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
) {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  return error ? null : data;
}

async function findEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
  month: string,
) {
  const { data, error } = await supabase
    .from("entries")
    .select(entrySelect)
    .eq("user_id", userId)
    .eq("account_id", accountId)
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado.";
}
