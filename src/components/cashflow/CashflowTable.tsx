"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, ChevronDown, ChevronRight, ListPlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createAccountAction,
  createCategoryAction,
} from "@/app/app/actions";
import { AccountCell } from "@/components/cashflow/AccountCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildMonthRange,
  buildRows,
  calculateClosingBalance,
  calculateOpeningBalance,
  calculateRowValue,
  entryKey,
  formatCurrency,
  isIncome,
  makeEntryMap,
  monthInputFromKey,
  monthShortTitle,
} from "@/lib/cashflow";
import type { Account, Category, CashflowRow, Entry, MonthInfo } from "@/lib/types";
import { type AccountFormValues, accountSchema, type CategoryFormValues, categorySchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { zodResolverIssue } from "@/components/setup/zodResolverIssue";

type CashflowTableProps = {
  categories: Category[];
  accounts: Account[];
  entries: Entry[];
  months: MonthInfo[];
  rangeMonths: MonthInfo[];
  rangeStart: string;
  rangeEnd: string;
  selectedMonths: string[];
};

type ToastState = {
  tone: "success" | "error";
  message: string;
};

type DrawerMode = "category" | "account" | "months" | null;

export function CashflowTable({
  categories: initialCategories,
  accounts: initialAccounts,
  entries: initialEntries,
  months,
  rangeMonths,
  rangeStart,
  rangeEnd,
  selectedMonths,
}: CashflowTableProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [entries, setEntries] = useState(initialEntries);
  const [groupOpen, setGroupOpen] = useState({ entrada: true, saida: true });
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const rows = useMemo(() => buildRows(categories, accounts), [categories, accounts]);
  const entryMap = useMemo(() => makeEntryMap(entries), [entries]);
  const incomeRows = useMemo(() => rows.filter((row) => isIncome(row.type)), [rows]);
  const expenseRows = useMemo(() => rows.filter((row) => !isIncome(row.type)), [rows]);

  function pushToast(message: string, tone: ToastState["tone"]) {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  }

  function upsertLocalEntry(entry: Entry, message: string) {
    setEntries((current) => {
      const next = current.filter(
        (item) => item.id !== entry.id && entryKey(item.account_id, item.month) !== entryKey(entry.account_id, entry.month),
      );
      return [...next, entry];
    });
    pushToast(message, "success");
  }

  function toggleGroup(kind: "entrada" | "saida") {
    setGroupOpen((current) => ({ ...current, [kind]: !current[kind] }));
  }

  function openDrawer(mode: Exclude<DrawerMode, null>) {
    setDrawerMode(mode);
  }

  return (
    <motion.div
      className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-background"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={
        {
          "--collapsed-month-width": "max(96px, calc((100vw - 320px - 16rem) / 12))",
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => openDrawer("category")}>
            <Plus className="size-4" />
            Nova categoria
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => openDrawer("account")}>
            <ListPlus className="size-4" />
            Novo lançamento
          </Button>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => openDrawer("months")}>
          <CalendarRange className="size-4" />
          {months.length} periodo{months.length === 1 ? "" : "s"}
          <ChevronDown className="size-4" />
        </Button>
      </div>

      <div className="h-[calc(100%-3.5rem)] overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[320px] min-w-[320px]" />
            {months.map((month) => (
              <col
                key={`col-${month.key}`}
                className="w-[var(--collapsed-month-width)] min-w-[var(--collapsed-month-width)] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 h-12 w-[320px] min-w-[320px] border-b border-r border-border bg-[#1a2b56] px-4 text-left font-semibold uppercase tracking-wide text-white">
                Meses
              </th>
              {months.map((month) => (
                <th key={month.key} className="border-b border-r border-border bg-[#1a2b56] p-0 text-white">
                  <MonthColumnHeader month={month} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <BalanceRow
              label="Saldo inicial"
              months={months}
              compute={(monthKey) => calculateOpeningBalance(rows, entries, monthKey)}
            />

            <GroupRow
              kind="entrada"
              label="Entradas"
              open={groupOpen.entrada}
              onToggle={() => toggleGroup("entrada")}
              months={months}
              total={(monthKey) => calculateTypeTotal(rows, entries, monthKey, "income")}
            />
            {groupOpen.entrada
              ? incomeRows.map((row) => (
                  <DataRow
                    key={`${row.kind}-${row.id}`}
                    row={row}
                    rows={rows}
                    entries={entries}
                    entryMap={entryMap}
                    months={months}
                    onSaved={upsertLocalEntry}
                    onError={(message) => pushToast(message, "error")}
                  />
                ))
              : null}

            <GroupRow
              kind="saida"
              label="Saídas"
              open={groupOpen.saida}
              onToggle={() => toggleGroup("saida")}
              months={months}
              total={(monthKey) => calculateTypeTotal(rows, entries, monthKey, "expense")}
            />
            {groupOpen.saida
              ? expenseRows.map((row) => (
                  <DataRow
                    key={`${row.kind}-${row.id}`}
                    row={row}
                    rows={rows}
                    entries={entries}
                    entryMap={entryMap}
                    months={months}
                    onSaved={upsertLocalEntry}
                    onError={(message) => pushToast(message, "error")}
                  />
                ))
              : null}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 h-12 w-[320px] min-w-[320px] border-t border-r border-border bg-background px-4 text-left text-sm font-bold uppercase tracking-wide">
                Saldo final
              </th>
              {months.map((month) => {
                const closing = calculateClosingBalance(rows, entries, month.key);

                return (
                  <td
                    key={`total-${month.key}`}
                    className="border-t border-r border-border bg-background px-3 py-2 text-center"
                  >
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        closing >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
                      )}
                    >
                      {formatCurrency(closing)}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <CashflowDrawer
        mode={drawerMode}
        categories={categories}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        selectedMonths={selectedMonths.length > 0 ? selectedMonths : rangeMonths.map((month) => monthInputFromKey(month.key))}
        onClose={() => setDrawerMode(null)}
        onCategoryCreated={(category, message) => {
          setCategories((current) => [...current, category]);
          router.refresh();
          pushToast(message, "success");
          setDrawerMode(null);
        }}
        onAccountCreated={(account, message) => {
          setAccounts((current) => [...current, account]);
          router.refresh();
          pushToast(message, "success");
          setDrawerMode(null);
        }}
        onError={(message) => pushToast(message, "error")}
      />

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
              "absolute bottom-5 right-5 z-30 rounded-md border px-4 py-3 text-sm shadow-lg",
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
            )}
          >
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function BalanceRow({
  label,
  months,
  compute,
}: {
  label: string;
  months: MonthInfo[];
  compute: (monthKey: string) => number;
}) {
  return (
    <tr>
      <th className="sticky left-0 z-[5] h-12 w-[320px] min-w-[320px] border-b border-r border-border bg-background px-4 text-left text-sm font-bold uppercase tracking-wide">
        {label}
      </th>
      {months.map((month) => {
        const value = compute(month.key);

        return (
          <td
            key={`balance-${label}-${month.key}`}
            className="h-12 border-b border-r border-border bg-background px-3 py-2 text-center"
          >
            <span
              className={cn(
                "font-bold tabular-nums",
                value === 0 && "text-muted-foreground/60",
                value > 0 && "text-emerald-700 dark:text-emerald-400",
                value < 0 && "text-rose-700 dark:text-rose-400",
              )}
            >
              {formatCurrency(value)}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

function GroupRow({
  kind,
  label,
  open,
  onToggle,
  months,
  total,
}: {
  kind: "entrada" | "saida";
  label: string;
  open: boolean;
  onToggle: () => void;
  months: MonthInfo[];
  total: (monthKey: string) => number;
}) {
  const isIncomeGroup = kind === "entrada";
  const toneClass = isIncomeGroup
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-rose-700 dark:text-rose-400";

  return (
    <tr>
      <th
        className={cn(
          "sticky left-0 z-[5] h-11 w-[320px] min-w-[320px] cursor-pointer select-none border-b border-r border-border bg-background px-4 text-left font-semibold uppercase tracking-wide transition-colors hover:bg-muted/30",
          toneClass,
        )}
        onClick={onToggle}
      >
        <button type="button" className="flex w-full items-center gap-2" aria-expanded={open}>
          <ChevronRight
            className={cn(
              "size-4 shrink-0 transition-transform duration-200 ease-out",
              open && "rotate-90",
            )}
          />
          <span>{label}</span>
        </button>
      </th>
      {months.map((month) => {
        const value = total(month.key);

        return (
          <td
            key={`group-${kind}-${month.key}`}
            className={cn(
              "h-11 border-b border-r border-border bg-background px-2 text-center font-semibold tabular-nums",
              toneClass,
            )}
          >
            <span className={cn(value === 0 && "opacity-50")}>{formatCurrency(value)}</span>
          </td>
        );
      })}
    </tr>
  );
}

function DataRow({
  row,
  rows,
  entries,
  entryMap,
  months,
  onSaved,
  onError,
}: {
  row: CashflowRow;
  rows: CashflowRow[];
  entries: Entry[];
  entryMap: Map<string, Entry>;
  months: MonthInfo[];
  onSaved: (entry: Entry, message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <tr className="group">
      <RowLabel row={row} />
      {months.map((month) => {
        const value = calculateRowValue(row, rows, entries, month.key);
        const ownValue = row.kind === "account" ? entryMap.get(entryKey(row.id, month.key))?.value ?? 0 : 0;

        return (
          <td
            key={`${row.id}-${month.key}`}
            className={cn(
              "h-11 overflow-hidden border-b border-r border-border px-2 text-center transition-colors duration-150 group-hover:bg-muted/30",
              row.kind === "category" && "bg-muted/40 font-semibold",
            )}
          >
            {row.kind === "account" ? (
              <div>
                <AccountCell
                  accountId={row.id}
                  month={month.key}
                  type={row.type}
                  value={value}
                  ownValue={ownValue}
                  onSaved={onSaved}
                  onError={onError}
                />
              </div>
            ) : (
              <div>
                <p
                  className={cn(
                    "text-center font-semibold tabular-nums",
                    value === 0 && "text-muted-foreground/45",
                    value !== 0 && isIncome(row.type) && "text-emerald-700 dark:text-emerald-300",
                    value !== 0 && !isIncome(row.type) && "text-rose-700 dark:text-rose-300",
                  )}
                >
                  {formatCurrency(value)}
                </p>
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function RowLabel({ row }: { row: CashflowRow }) {
  return (
    <th
      className={cn(
        "sticky left-0 z-[5] h-11 w-[320px] min-w-[320px] border-b border-r border-border bg-background px-4 text-left transition-colors duration-150 group-hover:bg-muted/40",
        row.kind === "category" && "bg-muted/70 font-bold",
      )}
    >
      <div className={cn("flex items-center gap-2", row.depth === 1 && "pl-5")}>
        <span className="truncate">{row.name}</span>
      </div>
    </th>
  );
}

function MonthColumnHeader({ month }: { month: MonthInfo }) {
  return (
    <div
      className={cn(
        "flex h-12 w-full items-center justify-center px-2 text-center text-white",
        month.isCurrent && "bg-amber-500/30",
      )}
    >
      <span className="truncate text-sm font-semibold capitalize">{month.label}</span>
    </div>
  );
}

function CashflowDrawer({
  mode,
  categories,
  rangeStart,
  rangeEnd,
  selectedMonths,
  onClose,
  onCategoryCreated,
  onAccountCreated,
  onError,
}: {
  mode: DrawerMode;
  categories: Category[];
  rangeStart: string;
  rangeEnd: string;
  selectedMonths: string[];
  onClose: () => void;
  onCategoryCreated: (category: Category, message: string) => void;
  onAccountCreated: (account: Account, message: string) => void;
  onError: (message: string) => void;
}) {
  if (!mode) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div className="absolute inset-0 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button type="button" aria-label="Fechar painel" className="absolute inset-0 bg-foreground/20" onClick={onClose} />
        <motion.aside
          initial={{ x: 420 }}
          animate={{ x: 0 }}
          exit={{ x: 420 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Fluxo de caixa</p>
              <h2 className="text-lg font-semibold">
                {mode === "category" ? "Nova categoria" : mode === "account" ? "Novo lançamento" : "Periodos visiveis"}
              </h2>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {mode === "category" ? (
              <QuickCategoryForm onCreated={onCategoryCreated} onError={onError} />
            ) : mode === "account" ? (
              <QuickAccountForm categories={categories} onCreated={onAccountCreated} onError={onError} />
            ) : (
              <MonthSelector
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                selectedMonths={selectedMonths}
              />
            )}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

function QuickCategoryForm({
  onCreated,
  onError,
}: {
  onCreated: (category: Category, message: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<CategoryFormValues>({ defaultValues: { name: "", type: "entrada" } });

  async function onSubmit(values: CategoryFormValues) {
    const parsed = categorySchema.safeParse(values);
    const issue = zodResolverIssue(parsed);

    if (issue) {
      onError(issue);
      return;
    }

    setPending(true);
    const result = await createCategoryAction(values);
    setPending(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }

    onCreated(result.data, result.message ?? "Categoria criada.");
    form.reset();
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Nome" id="quick-category-name">
        <Input id="quick-category-name" placeholder="Vendas de Animais" {...form.register("name")} />
      </Field>
      <Field label="Tipo" id="quick-category-type">
        <select
          id="quick-category-type"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          {...form.register("type")}
        >
          <option value="entrada">Entrada</option>
          <option value="saida">Saida</option>
        </select>
      </Field>
      <p className="text-xs text-muted-foreground">
        O código é gerado automaticamente conforme a ordem de criação dentro do grupo escolhido.
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar categoria"}
      </Button>
    </form>
  );
}

function QuickAccountForm({
  categories,
  onCreated,
  onError,
}: {
  categories: Category[];
  onCreated: (account: Account, message: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<AccountFormValues>({ defaultValues: { name: "", category_id: "" } });

  async function onSubmit(values: AccountFormValues) {
    const payload = { ...values, parent_id: null };
    const parsed = accountSchema.safeParse(payload);
    const issue = zodResolverIssue(parsed);

    if (issue) {
      onError(issue);
      return;
    }

    setPending(true);
    const result = await createAccountAction(payload);
    setPending(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }

    onCreated(result.data, result.message ?? "Lancamento criado.");
    form.reset({ name: "", category_id: "" });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Nome" id="quick-account-name">
        <Input id="quick-account-name" placeholder="Salario" {...form.register("name")} />
      </Field>
      <Field label="Categoria" id="quick-account-category">
        <select
          id="quick-account-category"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          {...form.register("category_id")}
        >
          <option value="">Selecione</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.type === "entrada" ? "Entrada" : "Saída"})
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-muted-foreground">
        O código é gerado automaticamente dentro da categoria escolhida.
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar lançamento"}
      </Button>
    </form>
  );
}

function MonthSelector({
  rangeStart,
  rangeEnd,
  selectedMonths,
}: {
  rangeStart: string;
  rangeEnd: string;
  selectedMonths: string[];
}) {
  const router = useRouter();
  const [draftStart, setDraftStart] = useState(rangeStart);
  const [draftEnd, setDraftEnd] = useState(rangeEnd);
  const [checkedMonths, setCheckedMonths] = useState<Set<string>>(new Set(selectedMonths));
  const draftMonths = useMemo(() => buildMonthRange(draftStart, draftEnd), [draftStart, draftEnd]);

  function toggle(value: string) {
    setCheckedMonths((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allDraftMonths = draftMonths.map((month) => monthInputFromKey(month.key));
    const enabled = allDraftMonths.filter((value) => checkedMonths.has(value));
    const selected = enabled.length > 0 ? enabled : allDraftMonths;
    router.push(`/app/cashflow?start=${draftStart}&end=${draftEnd}&selected=${selected.join(",")}`);
  }

  return (
    <form className="space-y-4" onSubmit={apply}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio" id="month-start">
          <Input id="month-start" type="month" value={draftStart} onChange={(event) => setDraftStart(event.target.value)} />
        </Field>
        <Field label="Fim" id="month-end">
          <Input id="month-end" type="month" value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCheckedMonths(new Set(draftMonths.map((month) => monthInputFromKey(month.key))))}
        >
          Selecionar todos
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setCheckedMonths(new Set())}>
          Limpar
        </Button>
      </div>
      <div className="grid max-h-[52dvh] grid-cols-2 gap-2 overflow-auto rounded-lg border border-border p-2">
        {draftMonths.map((month) => {
          const value = monthInputFromKey(month.key);
          const checked = checkedMonths.has(value);

          return (
            <label
              key={month.key}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-muted",
                checked && "border-primary bg-primary/5",
              )}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(value)} className="size-4 accent-primary" />
              <span className="capitalize">{monthShortTitle(month.key)}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Periodos selecionados alem de 12 meses continuam disponiveis com scroll horizontal na tabela.
      </p>
      <Button type="submit" className="w-full">
        Aplicar periodos
      </Button>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function calculateTypeTotal(rows: CashflowRow[], entries: Entry[], month: string, kind: "income" | "expense") {
  const map = makeEntryMap(entries);

  return rows
    .filter((row) => row.kind === "account" && (kind === "income" ? isIncome(row.type) : !isIncome(row.type)))
    .reduce((sum, row) => sum + (map.get(entryKey(row.id, month))?.value ?? 0), 0);
}
