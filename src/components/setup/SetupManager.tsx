"use client";

import { zodResolverIssue } from "@/components/setup/zodResolverIssue";
import {
  createCategoryAction,
  deleteCategoryAction,
  createItemAction,
  deleteItemAction,
  updateItemAction,
  updateCategoryAction,
} from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildRows } from "@/lib/cashflow";
import type { Item, Category } from "@/lib/types";
import { type ItemFormValues, itemSchema, type CategoryFormValues, categorySchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type SetupManagerProps = {
  categories: Category[];
  items: Item[];
};

export function SetupManager({ categories, items }: SetupManagerProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const rows = useMemo(() => buildRows(categories, items), [categories, items]);

  const categoryForm = useForm<CategoryFormValues>({
    defaultValues: { name: "", type: "entrada" },
  });
  const itemForm = useForm<ItemFormValues>({
    defaultValues: { name: "", category_id: "", type: "saida" },
  });
  const selectedItemType = useWatch({ control: itemForm.control, name: "type" }) ?? "saida";
  const itemTypeField = itemForm.register("type");
  const itemCategories = categories.filter((category) => category.type === selectedItemType);

  function showResult(result: { ok: boolean; message?: string; error?: string }) {
    if (result.ok) {
      setError("");
      setMessage(result.message ?? "Alteracao salva.");
      router.refresh();
      return;
    }

    setMessage("");
    setError(result.error ?? "Nao foi possivel salvar.");
  }

  async function submitCategory(values: CategoryFormValues) {
    const parsed = categorySchema.safeParse(editingCategory ? { ...values, id: editingCategory.id } : values);
    const issue = zodResolverIssue(parsed);

    if (issue) {
      setError(issue);
      return;
    }

    const result = editingCategory
      ? await updateCategoryAction({ ...values, id: editingCategory.id })
      : await createCategoryAction(values);

    showResult(result);
    if (result.ok) {
      categoryForm.reset({ name: "", type: "entrada" });
      setEditingCategory(null);
    }
  }

  async function submitItem(values: ItemFormValues) {
    const payload = {
      ...values,
      parent_id: null,
    };
    const parsed = itemSchema.safeParse(editingItem ? { ...payload, id: editingItem.id } : payload);
    const issue = zodResolverIssue(parsed);

    if (issue) {
      setError(issue);
      return;
    }

    const result = editingItem
      ? await updateItemAction({ ...payload, id: editingItem.id })
      : await createItemAction(payload);

    showResult(result);
    if (result.ok) {
      itemForm.reset({ name: "", category_id: "", type: "saida" });
      setEditingItem(null);
    }
  }

  function editCategory(category: Category) {
    setEditingCategory(category);
    categoryForm.reset({ name: category.name, type: category.type });
  }

  function editItem(item: Item) {
    const category = categories.find((categoryItem) => categoryItem.id === item.category_id);
    setEditingItem(item);
    itemForm.reset({
      name: item.name,
      category_id: item.category_id ?? "",
      type: item.type ?? category?.type ?? "saida",
    });
  }

  async function removeCategory(id: string) {
    showResult(await deleteCategoryAction(id));
  }

  async function removeItem(id: string) {
    showResult(await deleteItemAction(id));
  }

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-auto bg-muted/25 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[420px_1fr]">
        <section className="space-y-4">
          <FormPanel title={editingCategory ? "Editar categoria" : "Nova categoria"}>
            <form className="space-y-4" onSubmit={categoryForm.handleSubmit(submitCategory)}>
              <Field label="Nome" id="category-name">
                <Input id="category-name" {...categoryForm.register("name")} placeholder="Vendas de Animais" />
              </Field>
              <Field label="Tipo" id="category-type">
                <select
                  id="category-type"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  {...categoryForm.register("type")}
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saida</option>
                </select>
              </Field>
              <p className="text-xs text-muted-foreground">
                Código gerado automaticamente conforme a ordem dentro do grupo.
              </p>
              <div className="flex gap-2">
                <Button type="submit" className="hover:scale-[1.01]">
                  <Plus className="size-4" />
                  {editingCategory ? "Salvar" : "Criar"}
                </Button>
                {editingCategory ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(null);
                      categoryForm.reset({ name: "", type: "entrada" });
                    }}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          </FormPanel>

          <FormPanel title={editingItem ? "Editar item" : "Novo item"}>
            <form className="space-y-4" onSubmit={itemForm.handleSubmit(submitItem)}>
              <Field label="Nome" id="item-name">
                <Input id="item-name" {...itemForm.register("name")} placeholder="Salario" />
              </Field>
              <Field label="Tipo" id="item-type">
                <select
                  id="item-type"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  {...itemTypeField}
                  onChange={(event) => {
                    itemTypeField.onChange(event);
                    itemForm.setValue("category_id", "");
                  }}
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saida</option>
                </select>
              </Field>
              <Field label="Categoria" id="item-category">
                <select
                  id="item-category"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  {...itemForm.register("category_id")}
                >
                  <option value="">Sem categoria</option>
                  {itemCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.type === "entrada" ? "Entrada" : "Saída"})
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-xs text-muted-foreground">
                Código gerado automaticamente dentro da categoria escolhida.
              </p>
              <div className="flex gap-2">
                <Button type="submit" className="hover:scale-[1.01]">
                  <Plus className="size-4" />
                  {editingItem ? "Salvar" : "Criar"}
                </Button>
                {editingItem ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingItem(null);
                      itemForm.reset({ name: "", category_id: "", type: "saida" });
                    }}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          </FormPanel>

          {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">Categorias e itens</h2>
          </div>
          <div className="divide-y divide-border">
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma categoria criada ainda.</p>
            ) : (
              rows.map((row) => (
                <div
                  key={`${row.kind}-${row.id}`}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/50",
                    row.kind === "category" && "bg-muted/40 font-semibold",
                  )}
                >
                  <div className={cn("min-w-0", row.depth === 1 && "pl-6")}>
                    <p className="truncate text-sm">
                      <span className="text-muted-foreground">{row.code}</span> {row.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.kind === "category" ? (row.type === "entrada" ? "Entrada" : "Saida") : "Item"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar"
                      onClick={() => {
                        if (row.kind === "category") {
                          const category = categories.find((item) => item.id === row.id);
                          if (category) editCategory(category);
                        } else {
                          const Item = items.find((item) => item.id === row.id);
                          if (Item) editItem(Item);
                        }
                      }}
                    >
                      <Edit3 className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      aria-label="Deletar"
                      onClick={() => (row.kind === "category" ? removeCategory(row.id) : removeItem(row.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FormPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
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

