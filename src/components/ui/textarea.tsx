import type * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 min-h-16 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
