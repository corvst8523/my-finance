import type { ZodSafeParseResult } from "zod";

export function zodResolverIssue<T>(result: ZodSafeParseResult<T>) {
  if (result.success) {
    return "";
  }

  return result.error.issues[0]?.message ?? "Dados invalidos.";
}
