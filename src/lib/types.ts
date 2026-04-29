export type CategoryType = "entrada" | "saida";

export type Category = {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: CategoryType;
};

export type Account = {
  id: string;
  user_id: string;
  category_id: string;
  parent_id: string | null;
  code: string;
  name: string;
};

export type Entry = {
  id: string;
  user_id: string;
  account_id: string;
  month: string;
  value: number;
  note: string | null;
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
      kind: "account";
      id: string;
      categoryId: string;
      parentId: string | null;
      code: string;
      name: string;
      type: CategoryType;
      depth: 1 | 2;
    };

export type MutationResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };
