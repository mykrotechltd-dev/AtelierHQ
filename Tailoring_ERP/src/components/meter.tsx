import { cn } from "@/lib/utils.ts";

const BARS = {
  primary: "bg-primary",
  good: "bg-success",
  warn: "bg-warning",
  crit: "bg-destructive",
} as const;

/** Thin horizontal progress bar with an accessible text label. */
export default function Meter({
  value,
  max = 100,
  tone = "primary",
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: keyof typeof BARS;
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", BARS[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
