import { z } from "zod";

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe pelo menos 2 caracteres."),
  type: z.enum(["entrada", "saida"]),
});

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe pelo menos 2 caracteres."),
  category_id: z.string().uuid("Escolha uma categoria."),
  parent_id: z.string().uuid().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
export type AccountFormValues = z.infer<typeof accountSchema>;
