import { addMonths, differenceInCalendarMonths, format, isSameMonth, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Account, CashflowRow, Category, Entry, MonthInfo } from "@/lib/types";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function monthKey(date: Date) {
  return format(startOfMonth(date), "yyyy-MM-01");
}

export function buildMonthWindow(offsetMonths = 0, totalMonths = 25): MonthInfo[] {
  const count = Math.min(Math.max(totalMonths, 1), 60);
  const current = startOfMonth(new Date());
  const start = addMonths(current, -12 + offsetMonths);

  return Array.from({ length: count }, (_, index) => {
    const date = addMonths(start, index);

    return {
      key: monthKey(date),
      label: format(date, "MMM/yyyy", { locale: ptBR }).replace(".", ""),
      isCurrent: isSameMonth(date, current),
    };
  });
}

export function buildMonthRange(startInput: string, endInput: string, limit = 48): MonthInfo[] {
  const current = startOfMonth(new Date());
  const start = parseMonthInput(startInput) ?? new Date(current.getFullYear(), 0, 1);
  const end = parseMonthInput(endInput) ?? new Date(current.getFullYear(), 11, 1);
  const normalizedStart = start <= end ? start : end;
  const normalizedEnd = start <= end ? end : start;
  const count = Math.min(differenceInCalendarMonths(normalizedEnd, normalizedStart) + 1, limit);

  return Array.from({ length: count }, (_, index) => {
    const date = addMonths(normalizedStart, index);

    return {
      key: monthKey(date),
      label: format(date, "MMM/yyyy", { locale: ptBR }).replace(".", ""),
      isCurrent: isSameMonth(date, current),
    };
  });
}

export function currentYearMonthRange() {
  const year = new Date().getFullYear();
  return {
    start: `${year}-01`,
    end: `${year}-12`,
  };
}

export function monthInputFromKey(key: string) {
  return key.slice(0, 7);
}

export function monthTitle(key: string) {
  return format(parseISO(key), "MMMM 'de' yyyy", { locale: ptBR });
}

export function monthShortTitle(key: string) {
  return format(parseISO(key), "MMM/yyyy", { locale: ptBR }).replace(".", "");
}

export function isIncome(type: string) {
  return ["entrada", "income", "receita"].includes(type.toLowerCase());
}

export function buildRows(categories: Category[], accounts: Account[]): CashflowRow[] {
  const sortedCategories = [...categories].sort(compareCode);
  const accountsByCategory = new Map<string, Account[]>();

  for (const account of accounts) {
    accountsByCategory.set(account.category_id, [...(accountsByCategory.get(account.category_id) ?? []), account]);
  }

  const rows: CashflowRow[] = [];

  for (const category of sortedCategories) {
    rows.push({
      kind: "category",
      id: category.id,
      code: category.code,
      name: category.name,
      type: category.type,
      depth: 0,
    });

    for (const account of [...(accountsByCategory.get(category.id) ?? [])].sort(compareCode)) {
      rows.push({
        kind: "account",
        id: account.id,
        categoryId: category.id,
        parentId: null,
        code: account.code,
        name: account.name,
        type: category.type,
        depth: 1,
      });
    }
  }

  return rows;
}

export function entryKey(accountId: string, month: string) {
  return `${accountId}:${month}`;
}

export function makeEntryMap(entries: Entry[]) {
  return new Map(entries.map((entry) => [entryKey(entry.account_id, entry.month), entry]));
}

export function getOwnValue(entries: Entry[], accountId: string, month: string) {
  return makeEntryMap(entries).get(entryKey(accountId, month))?.value ?? 0;
}

export function calculateRowValue(row: CashflowRow, rows: CashflowRow[], entries: Entry[], month: string) {
  const map = makeEntryMap(entries);

  if (row.kind === "category") {
    return rows
      .filter((candidate) => candidate.kind === "account" && candidate.categoryId === row.id)
      .reduce((sum, account) => sum + (map.get(entryKey(account.id, month))?.value ?? 0), 0);
  }

  const own = map.get(entryKey(row.id, month))?.value ?? 0;
  return own;
}

export function calculateMonthTotal(rows: CashflowRow[], entries: Entry[], month: string) {
  const map = makeEntryMap(entries);

  return rows
    .filter((row) => row.kind === "account")
    .reduce((sum, row) => {
      const value = map.get(entryKey(row.id, month))?.value ?? 0;
      return sum + (isIncome(row.type) ? value : -value);
    }, 0);
}

export function calculateOpeningBalance(rows: CashflowRow[], entries: Entry[], month: string) {
  const accountTypeById = new Map<string, "income" | "expense">();
  for (const row of rows) {
    if (row.kind === "account") {
      accountTypeById.set(row.id, isIncome(row.type) ? "income" : "expense");
    }
  }

  return entries.reduce((sum, entry) => {
    if (entry.month >= month) {
      return sum;
    }
    const kind = accountTypeById.get(entry.account_id);
    if (!kind) {
      return sum;
    }
    return sum + (kind === "income" ? entry.value : -entry.value);
  }, 0);
}

export function calculateClosingBalance(rows: CashflowRow[], entries: Entry[], month: string) {
  return calculateOpeningBalance(rows, entries, month) + calculateMonthTotal(rows, entries, month);
}

function compareCode<T extends { code: string; name: string }>(a: T, b: T) {
  const left = a.code.split(".").map(Number);
  const right = b.code.split(".").map(Number);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return a.name.localeCompare(b.name, "pt-BR");
}

function parseMonthInput(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) {
    return null;
  }

  return startOfMonth(new Date(year, month - 1, 1));
}
