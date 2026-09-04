// Shared aggregation helpers for the dashboard and reports pages — both pull
// from the same handful of tables/views and bucket by month or by order
// status, so the logic lives once here rather than drifting between the two
// pages the way the two report tables' JS-side day-merge already does.

export type MonthBucket = { key: string; label: string };

/** Last `n` calendar months ending with the current one, oldest first. */
export function lastNMonths(n: number, now: Date = new Date()): MonthBucket[] {
  const months: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    months.push({ key, label });
  }
  return months;
}

function monthKeyOf(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sums `valueField` per calendar month, aligned to `months` (zero-filled where there's no data). */
export function bucketMonthly<T extends Record<string, unknown>>(
  rows: T[],
  dateField: keyof T,
  valueField: keyof T,
  months: MonthBucket[]
): number[] {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const raw = row[dateField];
    if (typeof raw !== "string") continue;
    const key = monthKeyOf(raw);
    const value = Number(row[valueField] ?? 0);
    sums.set(key, (sums.get(key) ?? 0) + value);
  }
  return months.map((m) => sums.get(m.key) ?? 0);
}

// The four order statuses tracked in the pipeline views (order_status also
// has 'cancelled', deliberately excluded here — it's not a pipeline stage).
export const PIPELINE_STATUSES = ["received", "in_progress", "completed", "delivered"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  received: "Received",
  in_progress: "In Progress",
  completed: "Completed",
  delivered: "Delivered",
};

// Chart-mark colors — deliberately separate from StatusBadge's pastel
// badge palette (bg-*-100/text-*-800), which is tuned for small text pills,
// not full-saturation chart fills. Validated as a categorical set against
// this app's cream chart surface (#F7F3EA) with the dataviz skill's
// validator: passes lightness/chroma/CVD-separation; the sub-3:1 contrast
// WARN on all four is mitigated by every usage pairing color with a visible
// text label (pill cards, donut legend) rather than color alone.
export const STATUS_COLORS: Record<PipelineStatus, string> = {
  received: "#2a78d6", // blue
  in_progress: "#eb6834", // orange
  completed: "#1baf7a", // aqua/green
  delivered: "#eda100", // yellow
};

export function currencyNGN(amount: number): string {
  // Intl's "NGN" currency style renders the ₦ glyph in this runtime, not the
  // literal "NGN" text the reference design uses — spelled out explicitly
  // instead of leaving the symbol to whatever locale/runtime happens to render.
  return `NGN ${Math.round(amount).toLocaleString()}`;
}
