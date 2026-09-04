import { cn } from "@/lib/utils.ts";

export const STATUS_CONFIG = {
  received: {
    label: "Received",
    next: "in_progress",
    nextLabel: "Start work",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  in_progress: {
    label: "In Progress",
    next: "completed",
    nextLabel: "Mark completed",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Completed",
    next: "delivered",
    nextLabel: "Mark delivered",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  delivered: {
    label: "Delivered",
    next: null,
    nextLabel: null,
    color: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
} as const;

export type OrderStatus = keyof typeof STATUS_CONFIG;

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_CONFIG[status as OrderStatus] ?? STATUS_CONFIG.received;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-body",
        cfg.color,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
