"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCategoryAction, updateCategoryAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryUsage = {
  category: Category;
  itemCount: number;
  entryCount: number;
};

type CategoriesManagerProps = {
  usage: CategoryUsage[];
};

type ToastState = { tone: "success" | "error"; message: string };

export function CategoriesManager({ usage }: CategoriesManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<"entrada" | "saida">("entrada");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const incomeCategories = usage.filter((item) => item.category.type === "entrada");
  const expenseCategories = usage.filter((item) => item.category.type === "saida");

  function pushToast(message: string, tone: ToastState["tone"]) {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setDraftName(category.name);
    setDraftType(category.type);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName("");
  }

  async function saveEdit(category: Category) {
    if (draftName.trim().length < 2) {
      pushToast("Nome deve ter pelo menos 2 caracteres.", "error");
      return;
    }

    setPendingId(category.id);
    const result = await updateCategoryAction({
      id: category.id,
      name: draftName.trim(),
      type: draftType,
    });
    setPendingId(null);

    if (!result.ok) {
      pushToast(result.error, "error");
      return;
    }

    pushToast(result.message ?? "Categoria atualizada.", "success");
    setEditingId(null);
    router.refresh();
  }

  async function confirmDelete(category: Category) {
    setPendingId(category.id);
    const result = await deleteCategoryAction(category.id);
    setPendingId(null);
    setConfirmDeleteId(null);

    if (!result.ok) {
      pushToast(result.error, "error");
      return;
    }

    pushToast(result.message ?? "Categoria removida.", "success");
    router.refresh();
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-auto bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-semibold">Categorias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite o nome ou remova categorias. A exclusao fica bloqueada quando ha lancamentos mensais vinculados.
          </p>
        </header>

        <CategorySection
          title="Entradas"
          tone="income"
          items={incomeCategories}
          editingId={editingId}
          draftName={draftName}
          draftType={draftType}
          pendingId={pendingId}
          confirmDeleteId={confirmDeleteId}
          onDraftName={setDraftName}
          onDraftType={setDraftType}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onAskDelete={(id) => setConfirmDeleteId(id)}
          onCancelDelete={() => setConfirmDeleteId(null)}
          onConfirmDelete={confirmDelete}
        />

        <CategorySection
          title="SaÃƒÂ­das"
          tone="expense"
          items={expenseCategories}
          editingId={editingId}
          draftName={draftName}
          draftType={draftType}
          pendingId={pendingId}
          confirmDeleteId={confirmDeleteId}
          onDraftName={setDraftName}
          onDraftType={setDraftType}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onAskDelete={(id) => setConfirmDeleteId(id)}
          onCancelDelete={() => setConfirmDeleteId(null)}
          onConfirmDelete={confirmDelete}
        />
      </div>

      {toast ? (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-30 rounded-md border px-4 py-3 text-sm shadow-lg",
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
          )}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function CategorySection({
  title,
  tone,
  items,
  editingId,
  draftName,
  draftType,
  pendingId,
  confirmDeleteId,
  onDraftName,
  onDraftType,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  title: string;
  tone: "income" | "expense";
  items: CategoryUsage[];
  editingId: string | null;
  draftName: string;
  draftType: "entrada" | "saida";
  pendingId: string | null;
  confirmDeleteId: string | null;
  onDraftName: (value: string) => void;
  onDraftType: (value: "entrada" | "saida") => void;
  onStartEdit: (category: Category) => void;
  onCancelEdit: () => void;
  onSaveEdit: (category: Category) => Promise<void>;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (category: Category) => Promise<void>;
}) {
  const toneClass = tone === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400";

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className={cn("text-lg font-semibold uppercase tracking-wide", toneClass)}>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nenhuma categoria.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map(({ category, itemCount, entryCount }) => {
            const editing = editingId === category.id;
            const askingDelete = confirmDeleteId === category.id;
            const blockedReason =
              entryCount > 0
                ? `Possui ${entryCount} lancamento${entryCount === 1 ? "" : "s"} vinculado${entryCount === 1 ? "" : "s"}.`
                : null;
            const pending = pendingId === category.id;

            return (
              <li key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                      <div>
                        <Label htmlFor={`name-${category.id}`} className="sr-only">
                          Nome
                        </Label>
                        <Input
                          id={`name-${category.id}`}
                          value={draftName}
                          onChange={(event) => onDraftName(event.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label htmlFor={`type-${category.id}`} className="sr-only">
                          Tipo
                        </Label>
                        <select
                          id={`type-${category.id}`}
                          value={draftType}
                          onChange={(event) => onDraftType(event.target.value as "entrada" | "saida")}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                        >
                          <option value="entrada">Entrada</option>
                          <option value="saida">SaÃƒÂ­da</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {itemCount} item{itemCount === 1 ? "" : "s"} - {entryCount} lancamento
                        {entryCount === 1 ? "" : "s"} mensal{entryCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  {editing ? (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="default"
                        disabled={pending}
                        onClick={() => onSaveEdit(category)}
                        aria-label="Salvar"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        disabled={pending}
                        onClick={onCancelEdit}
                        aria-label="Cancelar"
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : askingDelete ? (
                    <>
                      <span className="text-xs text-muted-foreground">Confirmar?</span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => onConfirmDelete(category)}
                        aria-label="Confirmar exclusÃƒÂ£o"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        disabled={pending}
                        onClick={onCancelDelete}
                        aria-label="Cancelar"
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => onStartEdit(category)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive disabled:text-muted-foreground"
                        onClick={() => onAskDelete(category.id)}
                        disabled={Boolean(blockedReason)}
                        aria-label="Excluir"
                        title={blockedReason ?? "Excluir"}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>

                {blockedReason && !editing && !askingDelete ? (
                  <p className="basis-full text-xs text-muted-foreground">{blockedReason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
