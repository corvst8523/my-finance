import { redirect } from "next/navigation";
import { SetupManager } from "@/components/setup/SetupManager";
import { createClient } from "@/lib/supabase/server";
import type { Item, Category } from "@/lib/types";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [categoriesResult, accountsResultWithType] = await Promise.all([
    supabase.from("categories").select("id,user_id,code,name,type").eq("user_id", user.id).order("code"),
    supabase.from("items").select("id,user_id,category_id,parent_id,code,name,type").eq("user_id", user.id).order("code"),
  ]);
  const accountsResult = isMissingAccountsType(accountsResultWithType.error)
    ? await supabase.from("items").select("id,user_id,category_id,parent_id,code,name").eq("user_id", user.id).order("code")
    : accountsResultWithType;

  if (categoriesResult.error || accountsResult.error) {
    throw new Error(categoriesResult.error?.message ?? accountsResult.error?.message ?? "Erro ao buscar dados.");
  }

  return (
    <SetupManager
      categories={(categoriesResult.data ?? []) as Category[]}
      items={(accountsResult.data ?? []) as Item[]}
    />
  );
}

function isMissingAccountsType(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return message.includes("items.type") || (message.includes("items") && message.includes("type"));
}
