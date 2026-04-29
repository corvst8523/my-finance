import { z } from "zod";

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe pelo menos 2 caracteres."),
  type: z.enum(["entrada", "saida"]),
});

export const itemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe pelo menos 2 caracteres."),
  category_id: z
    .union([z.string().uuid("Escolha uma categoria valida."), z.literal("")])
    .optional()
    .transform((value) => value || null),
  type: z.enum(["entrada", "saida"]),
  parent_id: z.string().uuid().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
export type ItemFormValues = z.input<typeof itemSchema>;
