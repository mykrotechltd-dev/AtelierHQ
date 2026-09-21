import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Clock, Plus, Scissors } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMyTenant } from "@/lib/queries/tenants.ts";
import {
  useDashboardStats,
  useRevenueByMonth,
  useWorkerPerformance,
} from "@/lib/queries/analytics.ts";
import { useOrders } from "@/lib/queries/orders.ts";
import { formatCurrency as fmt } from "@/lib/format-currency.ts";
import { STATUS_CONFIG } from "@/lib/order-status.ts";
import PageHeader from "@/components/page-header.tsx";
import KpiCard from "@/components/kpi-card.tsx";
import Chip, { type ChipTone } from "@/components/chip.tsx";
import Meter from "@/components/meter.tsx";
import InitialsAvatar from "@/components/initials-avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const PIPELINE = [
  { key: "received", color: "bg-muted-foreground/50" },
  { key: "in_progress", color: "bg-primary" },
  { key: "completed", color: "bg-success" },
  { key: "delivered", color: "bg-border" },
] as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dueChip(dueDate: string): { tone: ChipTone; label: string } {
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (days < 0)
    return {
      tone: "crit",
      label: `Overdue ${-days} day${days === -1 ? "" : "s"}`,
    };
  if (days === 0) return { tone: "warn", label: "Due today" };
  return { tone: "neutral", label: `In ${days} day${days === 1 ? "" : "s"}` };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const tenant = useMyTenant();
  const stats = useDashboardStats();
  const revenue = useRevenueByMonth();
  const team = useWorkerPerformance();
  const { results: orders } = useOrders(undefined, 50);

  const currency = tenant?.currency ?? "USD";
  const loading =
    stats === undefined || revenue === undefined || tenant === undefined;

  const dueSoon = orders
    .filter((o) => o.dueDate && o.status !== "delivered")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 5);

  const openOrders = stats
    ? stats.orderCounts.received +
      stats.orderCounts.in_progress +
      stats.orderCounts.completed
    : 0;
  const pipelineTotal = stats
    ? PIPELINE.reduce((a, p) => a + stats.orderCounts[p.key], 0)
    : 0;
  const busiest = (team ?? []).reduce(
    (m, w) => Math.max(m, w.pending + w.inProgress),
    1,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 md:p-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}${tenant ? ", " + tenant.name : ""}`}
        description="Here is what is moving in your shop today."
      >
        <Button variant="outline" onClick={() => navigate("/patterns")}>
          <Scissors /> Draft pattern
        </Button>
        <Button onClick={() => navigate("/orders")}>
          <Plus /> New order
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <KpiCard
              raised
              label="Revenue this month"
              value={fmt(stats.revenueThisMonth, currency)}
              chip={`${fmt(stats.totalOutstanding, currency)} outstanding`}
              tone={stats.totalOutstanding > 0 ? "warn" : "good"}
              onClick={() => navigate("/payments")}
            />
            <KpiCard
              label="Open orders"
              value={String(openOrders)}
              chip={`${stats.orderCounts.in_progress} in progress`}
              tone="accent"
              onClick={() => navigate("/orders")}
            />
            <KpiCard
              label="Active workers"
              value={String(stats.activeWorkers)}
              chip={`${stats.tasksInProgress} tasks underway`}
              onClick={() => navigate("/workers")}
            />
            <KpiCard
              label="Pending tasks"
              value={String(stats.tasksPending)}
              chip={`${stats.tasksDone} completed`}
              tone={stats.tasksPending > 0 ? "warn" : "good"}
              onClick={() => navigate("/tasks")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
            <Card className="p-5 md:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-sans text-base font-semibold">
                    Billed and collected
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Last six months
                  </p>
                </div>
                <div className="flex gap-4 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <i className="size-2.5 rounded-sm bg-primary" />
                    Collected
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="size-2.5 rounded-sm bg-muted-foreground/40" />
                    Billed
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={revenue}
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                  barGap={3}
                >
                  <CartesianGrid
                    strokeDasharray="3 5"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}m`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : String(v)
                    }
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      fmt(Number(value), currency),
                      name === "billed" ? "Billed" : "Collected",
                    ]}
                  />
                  <Bar
                    dataKey="billed"
                    name="billed"
                    fill="var(--muted-foreground)"
                    fillOpacity={0.35}
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="collected"
                    name="collected"
                    fill="var(--primary)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5 md:p-6">
              <div className="mb-4">
                <h2 className="font-sans text-base font-semibold">
                  Order pipeline
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  {stats.totalOrders} orders in total
                </p>
              </div>
              <div
                className="mb-5 flex h-3 gap-[3px] overflow-hidden rounded-full"
                aria-hidden="true"
              >
                {PIPELINE.map((p) =>
                  stats.orderCounts[p.key] > 0 ? (
                    <i
                      key={p.key}
                      className={`h-full rounded-full ${p.color}`}
                      style={{ flex: stats.orderCounts[p.key] }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="space-y-3.5">
                {PIPELINE.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => navigate(`/orders?status=${p.key}`)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm"
                    >
                      <span className="flex items-center gap-2.5">
                        <i className={`size-2.5 rounded-sm ${p.color}`} />
                        {STATUS_CONFIG[p.key].label}
                      </span>
                      <span className="tabular-nums">
                        <b>{stats.orderCounts[p.key]}</b>
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {pipelineTotal
                            ? Math.round(
                                (stats.orderCounts[p.key] / pipelineTotal) *
                                  100,
                              )
                            : 0}
                          %
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
            <Card className="p-5 shadow-lg shadow-foreground/5 md:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-sans text-base font-semibold">
                    Due soon
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Open orders by deadline
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
                  All orders
                </Button>
              </div>
              {dueSoon.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No open orders have a due date.
                </p>
              ) : (
                <ul className="divide-y">
                  {dueSoon.map((o) => {
                    const chip = dueChip(o.dueDate as string);
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${o.id}`)}
                          className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 py-3.5 text-left first:pt-0 last:pb-0"
                        >
                          <span className="min-w-0 flex-1 basis-40">
                            <b className="block truncate font-semibold">
                              {o.customerName}
                            </b>
                            <span className="text-[13px] text-muted-foreground">
                              {o.orderNumber}
                            </span>
                          </span>
                          <Chip tone={chip.tone}>
                            <Clock /> {chip.label}
                          </Chip>
                          <span
                            className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ${STATUS_CONFIG[o.status].color}`}
                          >
                            {STATUS_CONFIG[o.status].label}
                          </span>
                          <b className="min-w-20 text-right tabular-nums">
                            {fmt(o.totalAmount, currency)}
                          </b>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5 md:p-6">
              <div className="mb-4">
                <h2 className="font-sans text-base font-semibold">
                  Team workload
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  Open tasks per person
                </p>
              </div>
              {team === undefined ? (
                <Skeleton className="h-32 w-full" />
              ) : team.filter((w) => w.isActive).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Add workers to see who is busy.
                </p>
              ) : (
                <ul className="space-y-4">
                  {team
                    .filter((w) => w.isActive)
                    .map((w) => {
                      const open = w.pending + w.inProgress;
                      return (
                        <li key={w.name}>
                          <div className="mb-2 flex items-center gap-3">
                            <InitialsAvatar name={w.name} size="sm" />
                            <b className="min-w-0 flex-1 truncate font-semibold">
                              {w.name}
                            </b>
                            <span className="text-[13px] text-muted-foreground tabular-nums">
                              {open} open
                            </span>
                          </div>
                          <Meter
                            value={open}
                            max={busiest}
                            tone={open === busiest && open > 0 ? "warn" : "primary"}
                            label={`${w.name} has ${open} open tasks`}
                          />
                        </li>
                      );
                    })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
