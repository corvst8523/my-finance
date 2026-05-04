import { redirect } from "next/navigation";
import { CashflowTable } from "@/components/cashflow/CashflowTable";
import { buildMonthRange, currentYearMonthRange, monthInputFromKey } from "@/lib/cashflow";
import { createClient } from "@/lib/supabase/server";
import type { Item, Category, Entry } from "@/lib/types";

type CashflowPageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    selected?: string;
  }>;
};

export default async function CashflowPage({ searchParams }: CashflowPageProps) {
  const params = await searchParams;
  const defaults = currentYearMonthRange();
  const rangeStart = sanitizeMonthInput(params.start) ?? defaults.start;
  const rangeEnd = sanitizeMonthInput(params.end) ?? defaults.end;
  const rangeMonths = buildMonthRange(rangeStart, rangeEnd);
  const selected = parseSelectedMonths(params.selected);
  const months =
    selected.length > 0
      ? rangeMonths.filter((month) => selected.includes(monthInputFromKey(month.key)))
      : rangeMonths;
  const visibleMonths = months.length > 0 ? months : rangeMonths;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [categoriesResult, accountsResultWithType, entriesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,user_id,code,name,type")
      .eq("user_id", user.id)
      .order("code"),
    supabase
      .from("items")
      .select("id,user_id,category_id,parent_id,code,name,type")
      .eq("user_id", user.id)
      .order("code"),
    supabase.from("entries").select("id,user_id,item_id,month,value,note").eq("user_id", user.id),
  ]);
  const accountsResult = isMissingAccountsType(accountsResultWithType.error)
    ? await supabase
        .from("items")
        .select("id,user_id,category_id,parent_id,code,name")
        .eq("user_id", user.id)
        .order("code")
    : accountsResultWithType;

  if (categoriesResult.error || accountsResult.error || entriesResult.error) {
    throw new Error(
      categoriesResult.error?.message ??
        accountsResult.error?.message ??
        entriesResult.error?.message ??
        "Erro ao buscar dados.",
    );
  }

  const entries = (entriesResult.data ?? []).map((entry) => ({
    ...entry,
    value: Number(entry.value),
    note: entry.note ?? null,
  })) as Entry[];

  return (
    <CashflowTable
      categories={(categoriesResult.data ?? []) as Category[]}
      items={(accountsResult.data ?? []) as Item[]}
      entries={entries}
      months={visibleMonths}
      rangeMonths={rangeMonths}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      selectedMonths={selected}
    />
  );
}

function sanitizeMonthInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12 ? value : null;
}

function parseSelectedMonths(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => sanitizeMonthInput(item));
}

function isMissingAccountsType(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return message.includes("items.type") || (message.includes("items") && message.includes("type"));
}
