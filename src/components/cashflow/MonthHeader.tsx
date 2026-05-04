"use client";

import { motion } from "framer-motion";
import type { MonthInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type MonthHeaderProps = {
  month: MonthInfo;
  onSelect: () => void;
};

export function MonthHeader({ month, onSelect }: MonthHeaderProps) {
  return (
    <motion.button
      type="button"
      layoutId={`month-${month.key}`}
      className={cn(
        "hover:bg-muted focus-visible:ring-ring/40 flex w-full items-center justify-center rounded-md text-sm font-semibold transition hover:scale-[1.01] focus-visible:ring-3 focus-visible:outline-none",
        month.isCurrent && "bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100",
      )}
      onClick={onSelect}
    >
      {month.label}
    </motion.button>
  );
}
