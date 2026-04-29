"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { upsertEntryValue } from "@/app/app/actions";
import { formatCurrency, isIncome } from "@/lib/cashflow";
import type { CategoryType, Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

type AccountCellProps = {
  accountId: string;
  month: string;
  type: CategoryType;
  value: number;
  ownValue: number;
  onSaved: (entry: Entry, message: string) => void;
  onError: (message: string) => void;
};

export function AccountCell({ accountId, month, type, value, ownValue, onSaved, onError }: AccountCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(ownValue));
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tone = useMemo(() => (isIncome(type) ? "income" : "expense"), [type]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const parsed = Number(draft.replace(",", "."));

    if (!Number.isFinite(parsed)) {
      setDraft(String(ownValue));
      setEditing(false);
      onError("Informe um valor numerico.");
      return;
    }

    if (parsed === ownValue) {
      setEditing(false);
      return;
    }

    setPending(true);
    const result = await upsertEntryValue(accountId, month, parsed);
    setPending(false);
    setEditing(false);

    if (!result.ok) {
      setDraft(String(ownValue));
      onError(result.error);
      return;
    }

    onSaved(result.data, result.message ?? "Valor salvo.");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      setDraft(String(ownValue));
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        className="h-8 w-full rounded-md border border-ring bg-background px-2 text-center text-sm outline-none ring-3 ring-ring/20"
        value={draft}
        disabled={pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        aria-label="Editar valor"
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "h-8 w-full rounded-md px-2 text-center text-sm tabular-nums transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        value === 0 && "text-muted-foreground/45",
        value !== 0 && tone === "income" && "text-emerald-700 dark:text-emerald-300",
        value !== 0 && tone === "expense" && "text-rose-700 dark:text-rose-300",
      )}
      onClick={() => {
        setDraft(String(ownValue));
        setEditing(true);
      }}
    >
      {formatCurrency(value)}
    </button>
  );
}
