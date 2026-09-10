import { cn } from "@/lib/utils.ts";
import { STATUS_CONFIG, type OrderStatus } from "@/lib/order-status.ts";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status as OrderStatus] ?? STATUS_CONFIG.received;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-body",
        cfg.color,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
