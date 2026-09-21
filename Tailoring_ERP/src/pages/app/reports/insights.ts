import { formatCurrency as fmt } from "@/lib/format-currency.ts";
import type {
  useDashboardStats,
  useTopCustomers,
  useWorkerPerformance,
} from "@/lib/queries/analytics.ts";

type Stats = NonNullable<ReturnType<typeof useDashboardStats>>;
type Top = NonNullable<ReturnType<typeof useTopCustomers>>;
type Perf = NonNullable<ReturnType<typeof useWorkerPerformance>>;

/** Plain-language findings, computed only from figures already on the page. */
export function insights(
  stats: Stats,
  top: Top,
  perf: Perf,
  currency: string,
): string[] {
  const out: string[] = [];
  if (stats.totalBilled > 0) {
    const rate = Math.round((stats.totalCollected / stats.totalBilled) * 100);
    out.push(
      stats.totalOutstanding > 0
        ? `You have collected ${rate}% of what you billed. ${fmt(stats.totalOutstanding, currency)} is still to come in.`
        : "Every billed order has been paid in full.",
    );
  }
  const lead = top[0];
  if (lead && stats.totalBilled > 0) {
    const share = Math.round((lead.total / stats.totalBilled) * 100);
    out.push(
      `${lead.name} is your biggest customer at ${share}% of billing across ${lead.orderCount} order${lead.orderCount === 1 ? "" : "s"}.`,
    );
  }
  const busy = [...perf].sort((a, b) => b.done - a.done)[0];
  if (busy && busy.done > 0) {
    out.push(
      `${busy.name} has finished the most tasks (${busy.done}) and has ${busy.pending + busy.inProgress} still open.`,
    );
  }
  if (out.length === 0)
    out.push("Findings appear here once you have orders and payments.");
  return out;
}
