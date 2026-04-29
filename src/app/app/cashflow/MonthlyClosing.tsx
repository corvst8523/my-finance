"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { updateEntryNote } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateMonthTotal,
  calculateRowValue,
  entryKey,
  formatCurrency,
  isIncome,
  makeEntryMap,
  monthTitle,
} from "@/lib/cashflow";
import type { CashflowRow, Entry, MonthInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type MonthlyClosingProps = {
  month: MonthInfo | null;
  rows: CashflowRow[];
  entries: Entry[];
  onClose: () => void;
  onEntryChange: (entry: Entry, message: string) => void;
  onError: (message: string) => void;
};

export function MonthlyClosing({ month, rows, entries, onClose, onEntryChange, onError }: MonthlyClosingProps) {
  const [savingNote, setSavingNote] = useState("");
  const map = useMemo(() => makeEntryMap(entries), [entries]);

  if (!month) {
    return null;
  }

  const selectedMonth = month;

  const totalIncome = rows
    .filter((row) => row.kind === "item" && isIncome(row.type))
    .reduce((sum, row) => sum + (map.get(entryKey(row.id, month.key))?.value ?? 0), 0);
  const totalExpense = rows
    .filter((row) => row.kind === "item" && !isIncome(row.type))
    .reduce((sum, row) => sum + (map.get(entryKey(row.id, month.key))?.value ?? 0), 0);
  const balance = calculateMonthTotal(rows, entries, month.key);

  async function saveNote(itemId: string, note: string) {
    setSavingNote(itemId);
    const result = await updateEntryNote(itemId, selectedMonth.key, note);
    setSavingNote("");

    if (!result.ok) {
      onError(result.error);
      return;
    }

    onEntryChange(result.data, result.message ?? "Nota salva.");
  }

  return (
    <AnimatePresence>
      <motion.section
        key={month.key}
        layoutId={`month-${month.key}`}
        className="absolute inset-0 z-20 overflow-auto bg-background"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fechamento mensal</p>
              <h2 className="text-3xl font-semibold capitalize tracking-tight md:text-4xl">{monthTitle(month.key)}</h2>
            </div>
            <Button type="button" variant="outline" onClick={onClose} className="hover:scale-[1.01]">
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Summary label="Total de Entradas" value={totalIncome} tone="income" />
            <Summary label="Total de Saidas" value={totalExpense} tone="expense" />
            <Summary label="Saldo" value={balance} tone={balance >= 0 ? "income" : "expense"} />
          </div>

          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <ClosingSection
              title="Entradas"
              rows={rows.filter((row) => isIncome(row.type))}
              allRows={rows}
              entries={entries}
              month={month.key}
              savingNote={savingNote}
              onSaveNote={saveNote}
            />
            <ClosingSection
              title="Saidas"
              rows={rows.filter((row) => !isIncome(row.type))}
              allRows={rows}
              entries={entries}
              month={month.key}
              savingNote={savingNote}
              onSaveNote={saveNote}
            />
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function ClosingSection({
  title,
  rows,
  allRows,
  entries,
  month,
  savingNote,
  onSaveNote,
}: {
  title: string;
  rows: CashflowRow[];
  allRows: CashflowRow[];
  entries: Entry[];
  month: string;
  savingNote: string;
  onSaveNote: (itemId: string, note: string) => Promise<void>;
}) {
  const map = useMemo(() => makeEntryMap(entries), [entries]);

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const value = calculateRowValue(row, allRows, entries, month);
          const note = row.kind === "item" ? map.get(entryKey(row.id, month))?.note ?? "" : "";

          return (
            <motion.div
              key={`${row.kind}-${row.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "grid gap-3 px-4 py-3 md:grid-cols-[1fr_130px] md:items-start",
                row.kind === "category" && "bg-muted/50 font-semibold",
              )}
            >
              <div className={cn(row.depth === 1 && "pl-5")}>
                <p className="text-sm">
                  <span className="text-muted-foreground">{row.code}</span> {row.name}
                </p>
                {row.kind === "item" ? (
                  <Textarea
                    className="mt-2 min-h-12 text-xs"
                    defaultValue={note}
                    disabled={savingNote === row.id}
                    onBlur={(event) => onSaveNote(row.id, event.currentTarget.value)}
                    aria-label={`Nota de ${row.name}`}
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "text-right text-sm font-semibold tabular-nums",
                  value === 0 && "text-muted-foreground/60",
                  value !== 0 && isIncome(row.type) && "text-emerald-700 dark:text-emerald-300",
                  value !== 0 && !isIncome(row.type) && "text-rose-700 dark:text-rose-300",
                )}
              >
                {formatCurrency(value)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
