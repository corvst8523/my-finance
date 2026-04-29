import { addMonths, differenceInCalendarMonths, format, isSameMonth, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Item, CashflowRow, Category, Entry, MonthInfo } from "@/lib/types";

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

export function buildRows(categories: Category[], items: Item[]): CashflowRow[] {
  const sortedCategories = [...categories].sort(compareCode);
  const topLevelItems = items.filter((Item) => !Item.category_id).sort(compareCode);
  const itemsByCategory = new Map<string, Item[]>();

  for (const Item of items.filter((item) => item.category_id)) {
    const categoryId = Item.category_id;
    if (!categoryId) {
      continue;
    }
    itemsByCategory.set(categoryId, [...(itemsByCategory.get(categoryId) ?? []), Item]);
  }

  const rows: CashflowRow[] = [];
  const topLevelRows = [
    ...sortedCategories.map((category) => ({ kind: "category" as const, item: category })),
    ...topLevelItems.map((Item) => ({ kind: "item" as const, item: Item })),
  ].sort((a, b) => compareCode(a.item, b.item));

  for (const topLevelRow of topLevelRows) {
    if (topLevelRow.kind === "item") {
      const Item = topLevelRow.item;
      rows.push({
        kind: "item",
        id: Item.id,
        categoryId: null,
        parentId: Item.parent_id,
        code: Item.code,
        name: Item.name,
        type: Item.type ?? "saida",
        depth: 0,
      });
      continue;
    }

    const category = topLevelRow.item;
    rows.push({
      kind: "category",
      id: category.id,
      code: category.code,
      name: category.name,
      type: category.type,
      depth: 0,
    });

    for (const Item of [...(itemsByCategory.get(category.id) ?? [])].sort(compareCode)) {
      rows.push({
        kind: "item",
        id: Item.id,
        categoryId: category.id,
        parentId: Item.parent_id,
        code: Item.code,
        name: Item.name,
        type: category.type,
        depth: 1,
      });
    }
  }

  return rows;
}

export function entryKey(itemId: string, month: string) {
  return `${itemId}:${month}`;
}

export function makeEntryMap(entries: Entry[]) {
  return new Map(entries.map((entry) => [entryKey(entry.item_id, entry.month), entry]));
}

export function getOwnValue(entries: Entry[], itemId: string, month: string) {
  return makeEntryMap(entries).get(entryKey(itemId, month))?.value ?? 0;
}

export function calculateRowValue(row: CashflowRow, rows: CashflowRow[], entries: Entry[], month: string) {
  const map = makeEntryMap(entries);

  if (row.kind === "category") {
    return rows
      .filter((candidate) => candidate.kind === "item" && candidate.categoryId === row.id)
      .reduce((sum, Item) => sum + (map.get(entryKey(Item.id, month))?.value ?? 0), 0);
  }

  const own = map.get(entryKey(row.id, month))?.value ?? 0;
  return own;
}

export function calculateMonthTotal(rows: CashflowRow[], entries: Entry[], month: string) {
  const map = makeEntryMap(entries);

  return rows
    .filter((row) => row.kind === "item")
    .reduce((sum, row) => {
      const value = map.get(entryKey(row.id, month))?.value ?? 0;
      return sum + (isIncome(row.type) ? value : -value);
    }, 0);
}

export function calculateOpeningBalance(rows: CashflowRow[], entries: Entry[], month: string) {
  const itemTypeById = new Map<string, "income" | "expense">();
  for (const row of rows) {
    if (row.kind === "item") {
      itemTypeById.set(row.id, isIncome(row.type) ? "income" : "expense");
    }
  }

  return entries.reduce((sum, entry) => {
    if (entry.month >= month) {
      return sum;
    }
    const kind = itemTypeById.get(entry.item_id);
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
