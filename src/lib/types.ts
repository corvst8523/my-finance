export type CategoryType = "entrada" | "saida";

export type Category = {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: CategoryType;
};

export type Item = {
  id: string;
  user_id: string;
  category_id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  type?: CategoryType;
};

export type Entry = {
  id: string;
  user_id: string;
  item_id: string;
  month: string;
  value: number;
  note: string | null;
};

export type EntryChange = {
  entry: Entry | null;
  itemId: string;
  month: string;
};

export type MonthInfo = {
  key: string;
  label: string;
  isCurrent: boolean;
};

export type CashflowRow =
  | {
      kind: "category";
      id: string;
      code: string;
      name: string;
      type: CategoryType;
      depth: 0;
    }
  | {
      kind: "item";
      id: string;
      categoryId: string | null;
      parentId: string | null;
      code: string;
      name: string;
      type: CategoryType;
      depth: 0 | 1 | 2;
    };

export type MutationResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };
