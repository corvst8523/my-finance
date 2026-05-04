"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { upsertEntryValue } from "@/app/app/actions";
import { formatCurrency, isIncome } from "@/lib/cashflow";
import type { CategoryType, EntryChange } from "@/lib/types";
import { cn } from "@/lib/utils";

type ItemCellProps = {
  itemId: string;
  month: string;
  type: CategoryType;
  value: number;
  ownValue: number;
  onSaved: (change: EntryChange, message: string) => void;
  onError: (message: string) => void;
};

export function ItemCell({
  itemId,
  month,
  type,
  value,
  ownValue,
  onSaved,
  onError,
}: ItemCellProps) {
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
    const parsed = draft.trim() === "" ? 0 : Number(draft.replace(",", "."));

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
    const result = await upsertEntryValue(itemId, month, parsed);
    setPending(false);
    setEditing(false);

    if (!result.ok) {
      setDraft(String(ownValue));
      onError(result.error);
      return;
    }

    onSaved(result.data, result.message ?? "Lancamento salvo.");
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
        className="border-ring bg-background ring-ring/20 h-full min-h-11 w-full min-w-0 rounded-none border px-1 text-center text-sm ring-3 outline-none"
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
        "focus-visible:ring-ring/40 h-full min-h-11 w-full min-w-0 cursor-pointer rounded-none px-1 text-center text-sm whitespace-nowrap tabular-nums transition-colors duration-150 focus-visible:ring-3 focus-visible:outline-none",
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
