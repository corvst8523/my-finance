"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, ChevronDown, ChevronRight, ListPlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createCategoryAction, createItemAction, updateItemAction } from "@/app/app/actions";
import { ItemCell } from "@/components/cashflow/ItemCell";
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
import type { Category, CashflowRow, Entry, EntryChange, Item, MonthInfo } from "@/lib/types";
import {
  type ItemFormValues,
  itemSchema,
  type CategoryFormValues,
  categorySchema,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { zodResolverIssue } from "@/components/setup/zodResolverIssue";

type CashflowTableProps = {
  categories: Category[];
  items: Item[];
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

type DrawerMode = "category" | "item" | "months" | null;

export function CashflowTable({
  categories: initialCategories,
  items: initialItems,
  entries: initialEntries,
  months,
  rangeMonths,
  rangeStart,
  rangeEnd,
  selectedMonths,
}: CashflowTableProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [entries, setEntries] = useState(initialEntries);
  const [groupOpen, setGroupOpen] = useState({ entrada: true, saida: true });
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ kind: "category" | "item"; id: string } | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const rows = useMemo(() => buildRows(categories, items), [categories, items]);
  const entryMap = useMemo(() => makeEntryMap(entries), [entries]);
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          !(row.kind === "item" && row.categoryId && collapsedCategories.has(row.categoryId)),
      ),
    [rows, collapsedCategories],
  );
  const incomeRows = useMemo(() => visibleRows.filter((row) => isIncome(row.type)), [visibleRows]);
  const expenseRows = useMemo(
    () => visibleRows.filter((row) => !isIncome(row.type)),
    [visibleRows],
  );

  function toggleCategory(id: string) {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function saveRowName(row: CashflowRow, rawName: string) {
    const name = rawName.trim();
    if (!name || name === row.name) {
      setEditing(null);
      return;
    }

    if (row.kind !== "item") {
      setEditing(null);
      return;
    }

    const result = await updateItemAction({
      id: row.id,
      name,
      type: row.type,
      category_id: row.categoryId,
      parent_id: null,
    });
    if (!result.ok) {
      pushToast(result.error, "error");
      setEditing(null);
      return;
    }
    setItems((curr) => curr.map((i) => (i.id === row.id ? result.data : i)));
    pushToast(result.message ?? "Item atualizado.", "success");
    setEditing(null);
  }

  function pushToast(message: string, tone: ToastState["tone"]) {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  }

  function upsertLocalEntry(change: EntryChange, message: string) {
    setEntries((current) => {
      const next = current.filter(
        (entry) => entryKey(entry.item_id, entry.month) !== entryKey(change.itemId, change.month),
      );
      return change.entry ? [...next, change.entry] : next;
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
      className="bg-background relative h-[calc(100dvh-4rem)] overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={
        {
          "--collapsed-month-width": "max(112px, calc((100vw - 320px - 16rem) / 12))",
        } as React.CSSProperties
      }
    >
      <div className="border-border flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => openDrawer("category")}>
            <Plus className="size-4" />
            Nova categoria
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => openDrawer("item")}>
            <ListPlus className="size-4" />
            Novo item
          </Button>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => openDrawer("months")}>
          <CalendarRange className="size-4" />
          {months.length} periodo{months.length === 1 ? "" : "s"}
          <ChevronDown className="size-4" />
        </Button>
      </div>

      <div className="h-[calc(100%-3.5rem)] overflow-auto">
        <table className="w-full min-w-max table-fixed border-separate border-spacing-0 text-sm">
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
              <th className="border-border sticky left-0 z-20 h-12 w-[320px] min-w-[320px] border-r border-b bg-[#1a2b56] px-2 text-left text-base font-medium tracking-wide text-white uppercase">
                Meses
              </th>
              {months.map((month) => (
                <th
                  key={month.key}
                  className="border-border border-r border-b bg-[#1a2b56] p-0 text-white"
                >
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
                    collapsed={row.kind === "category" ? collapsedCategories.has(row.id) : false}
                    onToggleCollapse={toggleCategory}
                    editing={editing?.kind === row.kind && editing.id === row.id}
                    onStartEdit={() => setEditing({ kind: row.kind, id: row.id })}
                    onCancelEdit={() => setEditing(null)}
                    onSaveName={(value) => saveRowName(row, value)}
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
                    collapsed={row.kind === "category" ? collapsedCategories.has(row.id) : false}
                    onToggleCollapse={toggleCategory}
                    editing={editing?.kind === row.kind && editing.id === row.id}
                    onStartEdit={() => setEditing({ kind: row.kind, id: row.id })}
                    onCancelEdit={() => setEditing(null)}
                    onSaveName={(value) => saveRowName(row, value)}
                    onSaved={upsertLocalEntry}
                    onError={(message) => pushToast(message, "error")}
                  />
                ))
              : null}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr>
              <th className="border-border bg-background sticky left-0 z-20 h-12 w-[320px] min-w-[320px] border-t border-r px-2 text-left text-sm font-bold tracking-wide uppercase">
                Saldo final
              </th>
              {months.map((month) => {
                const closing = calculateClosingBalance(rows, entries, month.key);

                return (
                  <td
                    key={`total-${month.key}`}
                    className="border-border bg-background overflow-hidden border-t border-r px-2 py-2 text-center whitespace-nowrap"
                  >
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        closing >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-700 dark:text-rose-400",
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
        selectedMonths={
          selectedMonths.length > 0
            ? selectedMonths
            : rangeMonths.map((month) => monthInputFromKey(month.key))
        }
        onClose={() => setDrawerMode(null)}
        onCategoryCreated={(category, message) => {
          setCategories((current) => [...current, category]);
          router.refresh();
          pushToast(message, "success");
          setDrawerMode(null);
        }}
        onItemCreated={(item, message) => {
          setItems((current) => [...current, item]);
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
              "absolute right-5 bottom-5 z-30 rounded-md border px-4 py-3 text-sm shadow-lg",
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
      <th className="border-border bg-background sticky left-0 z-[5] h-12 w-[320px] min-w-[320px] border-r border-b px-2 text-left text-sm font-bold tracking-wide uppercase">
        {label}
      </th>
      {months.map((month) => {
        const value = compute(month.key);

        return (
          <td
            key={`balance-${label}-${month.key}`}
            className="border-border bg-background h-12 overflow-hidden border-r border-b px-2 py-2 text-center whitespace-nowrap"
          >
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
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
          "border-border bg-background sticky left-0 z-[5] h-11 w-[320px] min-w-[320px] border-r border-b p-0 text-left text-base font-medium tracking-wide select-none",
          toneClass,
        )}
      >
        <DisclosureCellButton label={label} open={open} onToggle={onToggle} className="px-4" />
      </th>
      {months.map((month) => {
        const value = total(month.key);

        return (
          <td
            key={`group-${kind}-${month.key}`}
            className={cn(
              "border-border bg-background h-11 overflow-hidden border-r border-b px-2 text-center text-sm font-semibold whitespace-nowrap tabular-nums",
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

function DisclosureCellButton({
  label,
  open,
  onToggle,
  className,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "hover:bg-muted/30 focus-visible:ring-ring/40 flex h-full min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight
        className={cn(
          "size-4 shrink-0 transition-transform duration-200 ease-out",
          open && "rotate-90",
        )}
      />
    </button>
  );
}

function DataRow({
  row,
  rows,
  entries,
  entryMap,
  months,
  collapsed,
  onToggleCollapse,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveName,
  onSaved,
  onError,
}: {
  row: CashflowRow;
  rows: CashflowRow[];
  entries: Entry[];
  entryMap: Map<string, Entry>;
  months: MonthInfo[];
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveName: (value: string) => void;
  onSaved: (change: EntryChange, message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <tr className="group">
      <RowLabel
        row={row}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        editing={editing}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onSaveName={onSaveName}
      />
      {months.map((month) => {
        const value = calculateRowValue(row, rows, entries, month.key);
        const ownValue =
          row.kind === "item" ? (entryMap.get(entryKey(row.id, month.key))?.value ?? 0) : 0;

        return (
          <td
            key={`${row.id}-${month.key}`}
            className={cn(
              "border-border h-11 overflow-hidden border-r border-b text-center whitespace-nowrap transition-colors duration-150",
              row.kind === "item" && "hover:bg-muted/30 cursor-pointer px-0",
              row.kind === "category" && "bg-white px-2 font-semibold dark:bg-neutral-900",
            )}
          >
            {row.kind === "item" ? (
              <div className="flex h-full min-w-0">
                <ItemCell
                  itemId={row.id}
                  month={month.key}
                  type={row.type}
                  value={value}
                  ownValue={ownValue}
                  onSaved={onSaved}
                  onError={onError}
                />
              </div>
            ) : (
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-center text-sm font-medium tabular-nums",
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

function RowLabel({
  row,
  collapsed,
  onToggleCollapse,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveName,
}: {
  row: CashflowRow;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveName: (value: string) => void;
}) {
  const isCategory = row.kind === "category";
  const isNestedItem = row.kind === "item" && row.categoryId;
  const itemIndentClass = isNestedItem ? "px-8" : "px-6";
  const itemWeightClass = isNestedItem ? "font-normal" : "font-semibold";

  return (
    <th
      className={cn(
        "border-border sticky left-0 z-[5] h-11 w-[320px] min-w-[320px] border-r border-b text-left text-base transition-colors duration-150",
        isCategory
          ? "bg-white p-0 font-semibold dark:bg-neutral-900"
          : cn(
              "group-hover:bg-muted/40 bg-white dark:bg-neutral-900",
              itemIndentClass,
              itemWeightClass,
            ),
      )}
    >
      {isCategory ? (
        <DisclosureCellButton
          label={row.name}
          open={!collapsed}
          onToggle={() => onToggleCollapse(row.id)}
          className="px-6 font-semibold"
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          {editing ? (
            <input
              autoFocus
              defaultValue={row.name}
              onBlur={(e) => onSaveName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveName(e.currentTarget.value);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-7 w-full rounded border px-2 text-base outline-none focus-visible:ring-2"
            />
          ) : (
            <span
              className="min-w-0 flex-1 cursor-text truncate"
              onDoubleClick={onStartEdit}
              title="Duplo clique para editar"
            >
              {row.name}
            </span>
          )}
        </div>
      )}
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
  onItemCreated,
  onError,
}: {
  mode: DrawerMode;
  categories: Category[];
  rangeStart: string;
  rangeEnd: string;
  selectedMonths: string[];
  onClose: () => void;
  onCategoryCreated: (category: Category, message: string) => void;
  onItemCreated: (item: Item, message: string) => void;
  onError: (message: string) => void;
}) {
  if (!mode) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Fechar painel"
          className="bg-foreground/20 absolute inset-0"
          onClick={onClose}
        />
        <motion.aside
          initial={{ x: 420 }}
          animate={{ x: 0 }}
          exit={{ x: 420 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="border-border bg-background absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l shadow-xl"
        >
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-muted-foreground text-xs">Fluxo de caixa</p>
              <h2 className="text-lg font-semibold">
                {mode === "category"
                  ? "Nova categoria"
                  : mode === "item"
                    ? "Novo item"
                    : "Periodos visiveis"}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {mode === "category" ? (
              <QuickCategoryForm onCreated={onCategoryCreated} onError={onError} />
            ) : mode === "item" ? (
              <QuickItemForm categories={categories} onCreated={onItemCreated} onError={onError} />
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
        <Input
          id="quick-category-name"
          placeholder="Vendas de Animais"
          {...form.register("name")}
        />
      </Field>
      <Field label="Tipo" id="quick-category-type">
        <select
          id="quick-category-type"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
          {...form.register("type")}
        >
          <option value="entrada">Entrada</option>
          <option value="saida">Saida</option>
        </select>
      </Field>
      <p className="text-muted-foreground text-xs">
        O codigo e gerado automaticamente dentro da categoria escolhida.
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar categoria"}
      </Button>
    </form>
  );
}

function QuickItemForm({
  categories,
  onCreated,
  onError,
}: {
  categories: Category[];
  onCreated: (item: Item, message: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<ItemFormValues>({
    defaultValues: { name: "", category_id: "", type: "saida" },
  });
  const selectedType = useWatch({ control: form.control, name: "type" }) ?? "saida";
  const typeField = form.register("type");
  const filteredCategories = categories.filter((category) => category.type === selectedType);

  async function onSubmit(values: ItemFormValues) {
    const payload = { ...values, parent_id: null };
    const parsed = itemSchema.safeParse(payload);
    const issue = zodResolverIssue(parsed);

    if (issue) {
      onError(issue);
      return;
    }

    setPending(true);
    const result = await createItemAction(payload);
    setPending(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }

    onCreated(result.data, result.message ?? "Item criado.");
    form.reset({ name: "", category_id: "", type: "saida" });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Nome" id="quick-item-name">
        <Input id="quick-item-name" placeholder="Salario" {...form.register("name")} />
      </Field>
      <Field label="Tipo" id="quick-item-type">
        <select
          id="quick-item-type"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
          {...typeField}
          onChange={(event) => {
            typeField.onChange(event);
            form.setValue("category_id", "");
          }}
        >
          <option value="entrada">Entrada</option>
          <option value="saida">Saida</option>
        </select>
      </Field>
      <Field label="Categoria" id="quick-item-category">
        <select
          id="quick-item-category"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
          {...form.register("category_id")}
        >
          <option value="">Sem categoria</option>
          {filteredCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.type === "entrada" ? "Entrada" : "Saída"})
            </option>
          ))}
        </select>
      </Field>
      <p className="text-muted-foreground text-xs">
        O codigo e gerado automaticamente dentro da categoria escolhida.
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar item"}
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
          <Input
            id="month-start"
            type="month"
            value={draftStart}
            onChange={(event) => setDraftStart(event.target.value)}
          />
        </Field>
        <Field label="Fim" id="month-end">
          <Input
            id="month-end"
            type="month"
            value={draftEnd}
            onChange={(event) => setDraftEnd(event.target.value)}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setCheckedMonths(new Set(draftMonths.map((month) => monthInputFromKey(month.key))))
          }
        >
          Selecionar todos
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCheckedMonths(new Set())}
        >
          Limpar
        </Button>
      </div>
      <div className="border-border grid max-h-[52dvh] grid-cols-2 gap-2 overflow-auto rounded-lg border p-2">
        {draftMonths.map((month) => {
          const value = monthInputFromKey(month.key);
          const checked = checkedMonths.has(value);

          return (
            <label
              key={month.key}
              className={cn(
                "border-border hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                checked && "border-primary bg-primary/5",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                className="accent-primary size-4"
              />
              <span className="capitalize">{monthShortTitle(month.key)}</span>
            </label>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        Periodos selecionados alem de 12 meses continuam disponiveis com scroll horizontal na
        tabela.
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

function calculateTypeTotal(
  rows: CashflowRow[],
  entries: Entry[],
  month: string,
  kind: "income" | "expense",
) {
  const map = makeEntryMap(entries);

  return rows
    .filter(
      (row) =>
        row.kind === "item" && (kind === "income" ? isIncome(row.type) : !isIncome(row.type)),
    )
    .reduce((sum, row) => sum + (map.get(entryKey(row.id, month))?.value ?? 0), 0);
}
