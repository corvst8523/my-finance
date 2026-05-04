import { redirect } from "next/navigation";
import { CategoriesManager } from "@/components/setup/CategoriesManager";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [categoriesResult, accountsResult, entriesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,user_id,code,name,type")
      .eq("user_id", user.id)
      .order("type")
      .order("code"),
    supabase.from("items").select("id,category_id").eq("user_id", user.id),
    supabase.from("entries").select("item_id,value").eq("user_id", user.id).neq("value", 0),
  ]);

  if (categoriesResult.error || accountsResult.error || entriesResult.error) {
    throw new Error(
      categoriesResult.error?.message ??
        accountsResult.error?.message ??
        entriesResult.error?.message ??
        "Erro ao buscar dados.",
    );
  }

  const items = accountsResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const itemsByCategory = new Map<string, number>();
  const itemsToCategory = new Map<string, string>();

  for (const Item of items) {
    if (!Item.category_id) continue;
    itemsByCategory.set(Item.category_id, (itemsByCategory.get(Item.category_id) ?? 0) + 1);
    itemsToCategory.set(Item.id, Item.category_id);
  }

  const entriesByCategory = new Map<string, number>();
  for (const entry of entries) {
    const categoryId = itemsToCategory.get(entry.item_id);
    if (!categoryId) continue;
    entriesByCategory.set(categoryId, (entriesByCategory.get(categoryId) ?? 0) + 1);
  }

  const usage = (categoriesResult.data ?? []).map((category) => ({
    category: category as Category,
    itemCount: itemsByCategory.get(category.id) ?? 0,
    entryCount: entriesByCategory.get(category.id) ?? 0,
  }));

  return <CategoriesManager usage={usage} />;
}
