import { cn } from "@/lib/utils.ts";
import type { AdminTone } from "@/lib/supabase/admin-types.ts";

// red = urgent, yellow = in progress, green = complete — the admin area's
// own badge, distinct from the tenant app's StatusBadge
// (src/pages/app/orders/_components/status-badge.tsx), which uses a
// separate blue/amber/emerald/muted scheme for order-workflow states.
const TONE_CONFIG: Record<AdminTone, { className: string; dot: string }> = {
  urgent: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
  },
  progress: {
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
  complete: {
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-500",
  },
};

export function AdminStatusBadge({
  tone,
  label,
  className,
}: {
  tone: AdminTone;
  label: string;
  className?: string;
}) {
  const cfg = TONE_CONFIG[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-body whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
      {label}
    </span>
  );
}
