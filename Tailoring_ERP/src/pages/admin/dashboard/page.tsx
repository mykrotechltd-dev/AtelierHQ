import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Clock,
  PackageMinus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useAdminDashboardStats } from "@/lib/queries/admin.ts";
import { useAdminOverview } from "@/lib/queries/admin-monitoring.ts";
import { formatCurrency as fmt } from "@/lib/format-currency.ts";
import PageHeader from "@/components/page-header.tsx";
import KpiCard from "@/components/kpi-card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AdminErrorState } from "../_components/admin-error-state.tsx";
import MonitoringUnavailable from "../_components/monitoring-unavailable.tsx";
import { cn } from "@/lib/utils.ts";

function today(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { stats, isLoading, isError, retry } = useAdminDashboardStats();
  const overview = useAdminOverview();
  const o = overview.data;

  const revenue = stats?.revenueByCurrency ?? [];
  const primary = [...revenue].sort((a, b) => b.month - a.month)[0];
  const others = primary
    ? revenue.filter((r) => r.currency !== primary.currency)
    : [];
  const peak = o ? Math.max(1, ...o.eventsByHour) : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <PageHeader
        eyebrow={today()}
        title="Platform overview"
        description="Here is what is moving across AtelierHQ today."
        className="mb-0"
      >
        <Button variant="outline" onClick={() => navigate("/admin/activity")}>
          Open live activity
        </Button>
      </PageHeader>

      {overview.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : overview.isError || !o ? (
        <MonitoringUnavailable onRetry={overview.retry} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <KpiCard
              raised
              label="Paying shops"
              value={String(o.shops.active)}
              chip={`${o.shops.total} shops in total`}
              tone="good"
              onClick={() => navigate("/admin/shops")}
            />
            <KpiCard
              label="MRR"
              value={
                o.mrr.length === 0
                  ? "—"
                  : o.mrr.map((m) => fmt(m.amount, m.currency)).join(" + ")
              }
              chip="Active plans, 30-day basis"
              tone="accent"
              onClick={() => navigate("/admin/revenue")}
            />
            <KpiCard
              label="Trials ending in 7 days"
              value={String(o.shops.trialsEndingSoon)}
              chip={`${o.shops.trialing} trialing now`}
              tone={o.shops.trialsEndingSoon > 0 ? "warn" : "neutral"}
              onClick={() => navigate("/admin/shops")}
            />
            <KpiCard
              label="Events in 24 hours"
              value={o.events24h.toLocaleString()}
              chip={`${o.activeShops7d} shops active this week`}
              onClick={() => navigate("/admin/activity")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card className="relative min-h-72 justify-center gap-3.5 overflow-hidden p-6 md:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 top-1/2 size-96 -translate-y-1/2 rounded-full border border-primary/15"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 top-1/2 size-64 -translate-y-1/2 rounded-full border border-primary/25"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-6 top-1/2 grid size-20 -translate-y-1/2 place-items-center rounded-3xl bg-primary text-primary-foreground"
              >
                <Sparkles className="size-8" />
              </div>
              <p className="relative text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Platform pulse
              </p>
              <h2 className="relative max-w-[16ch] font-sans text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                Every shop <span className="text-primary">accounted for.</span>
              </h2>
              <p className="relative max-w-md text-sm text-muted-foreground">
                {o.shops.total} shops, {o.activeShops7d} active this week.{" "}
                {o.shops.pastDue > 0
                  ? `${o.shops.pastDue} need a conversation about payment.`
                  : "No payments are overdue."}
              </p>
              <Button
                className="relative w-fit"
                onClick={() => navigate("/admin/shops")}
              >
                Review shops <ArrowUpRight />
              </Button>
            </Card>

            <Card className="p-5 md:p-6">
              <h2 className="mb-2 font-sans text-base font-semibold">
                Attention needed
              </h2>
              <ul className="divide-y">
                {[
                  {
                    icon: AlertTriangle,
                    tone: "text-destructive bg-destructive-soft",
                    title: `${o.shops.pastDue} shop${o.shops.pastDue === 1 ? "" : "s"} past due`,
                    sub: o.mrrAtRisk.length
                      ? `${o.mrrAtRisk.map((m) => fmt(m.amount, m.currency)).join(" + ")} of MRR at risk`
                      : "Nothing at risk",
                    to: "/admin/shops",
                    show: true,
                  },
                  {
                    icon: Clock,
                    tone: "text-warning bg-warning-soft",
                    title: `${o.shops.trialsEndingSoon} trial${o.shops.trialsEndingSoon === 1 ? "" : "s"} end this week`,
                    sub: "A short note now can turn a trial into a subscription",
                    to: "/admin/shops",
                    show: true,
                  },
                ].map((row) => (
                  <li key={row.title}>
                    <button
                      type="button"
                      onClick={() => navigate(row.to)}
                      className="flex w-full cursor-pointer items-center gap-3.5 py-3.5 text-left"
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl",
                          row.tone,
                        )}
                      >
                        <row.icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block font-semibold">{row.title}</b>
                        <span className="text-[13px] text-muted-foreground">
                          {row.sub}
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="p-5 md:p-6">
            <div className="mb-4">
              <h2 className="font-sans text-base font-semibold">
                Activity by hour
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Events across all shops today, Lagos time
              </p>
            </div>
            <div
              role="img"
              aria-label="Events per hour today"
              className="flex h-28 items-end gap-1"
            >
              {o.eventsByHour.map((n, hour) => (
                <i
                  key={hour}
                  title={`${String(hour).padStart(2, "0")}:00 · ${n} events`}
                  className={cn(
                    "min-h-1 flex-1 rounded-t-[3px]",
                    n === peak && n > 0 ? "bg-primary" : "bg-primary/25",
                  )}
                  style={{ height: `${Math.max(4, (n / peak) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </Card>
        </>
      )}

      <section aria-labelledby="ops-h" className="space-y-3.5">
        <h2
          id="ops-h"
          className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Shop operations
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : isError ? (
          <AdminErrorState onRetry={retry} />
        ) : !stats ? null : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <OpsCard
              label="Total revenue"
              icon={Wallet}
              value={primary ? fmt(primary.month, primary.currency) : "—"}
              sub={
                primary
                  ? `${fmt(primary.today, primary.currency)} today · ${fmt(primary.week, primary.currency)} this week`
                  : "No payments recorded yet"
              }
              footnote={
                others.length > 0
                  ? `+ ${others.map((r) => fmt(r.month, r.currency)).join(", ")} this month`
                  : undefined
              }
            />
            <OpsCard
              label="Active orders"
              icon={ClipboardList}
              value={String(stats.activeOrders)}
              sub="Received or in progress"
            />
            <OpsCard
              label="Pending fittings"
              icon={CalendarClock}
              value={String(stats.fittingsToday)}
              sub={`${stats.fittingsThisWeek} scheduled this week`}
            />
            <OpsCard
              label="Low inventory"
              icon={PackageMinus}
              value={String(stats.lowInventoryCount)}
              sub="Items at or below reorder threshold"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function OpsCard({
  label,
  value,
  sub,
  footnote,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  footnote?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {label}
          </p>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="font-display text-2xl font-semibold tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        {footnote && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
            {footnote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
