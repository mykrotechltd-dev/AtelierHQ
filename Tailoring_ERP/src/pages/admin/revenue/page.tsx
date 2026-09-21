import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useAdminOverview,
  useAdminRecentPayments,
} from "@/lib/queries/admin-monitoring.ts";
import { formatCurrency as fmt } from "@/lib/format-currency.ts";
import PageHeader from "@/components/page-header.tsx";
import KpiCard from "@/components/kpi-card.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import MonitoringUnavailable from "../_components/monitoring-unavailable.tsx";

export default function AdminRevenuePage() {
  const overview = useAdminOverview();
  const payments = useAdminRecentPayments(15);
  const o = overview.data;

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 md:p-8">
      <PageHeader
        eyebrow="Subscriptions"
        title="Revenue"
        description="Recurring revenue, growth and the payments that landed. Currencies are never added together."
        className="mb-0"
      />

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
            {o.mrr.length === 0 ? (
              <KpiCard
                raised
                label="MRR"
                value="—"
                chip="No paying shops yet"
              />
            ) : (
              o.mrr.map((m, i) => (
                <KpiCard
                  key={m.currency}
                  raised={i === 0}
                  label={`MRR · ${m.currency}`}
                  value={fmt(m.amount, m.currency)}
                  chip={`${fmt(m.amount * 12, m.currency)} a year`}
                  tone="good"
                />
              ))
            )}
            <KpiCard
              label="Paying shops"
              value={String(o.shops.active)}
              chip={`${o.shops.total} in total`}
              tone="accent"
            />
            <KpiCard
              label="Trials ending in 7 days"
              value={String(o.shops.trialsEndingSoon)}
              chip={`${o.shops.trialing} trialing`}
              tone={o.shops.trialsEndingSoon > 0 ? "warn" : "neutral"}
            />
            <KpiCard
              label="Past due"
              value={String(o.shops.pastDue)}
              chip={
                o.mrrAtRisk.length
                  ? o.mrrAtRisk
                      .map((m) => `${fmt(m.amount, m.currency)} at risk`)
                      .join(", ")
                  : "Nothing at risk"
              }
              tone={o.shops.pastDue > 0 ? "crit" : "good"}
            />
          </div>

          <Card className="p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-sans text-base font-semibold">
                  New shops and paying shops
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  Per week, last eight weeks. Paying counts shops with a
                  subscription payment that week.
                </p>
              </div>
              <div className="flex gap-4 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <i className="size-2.5 rounded-sm bg-muted-foreground/40" />
                  New shops
                </span>
                <span className="flex items-center gap-2">
                  <i className="size-2.5 rounded-sm bg-primary" />
                  Paying
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={o.weekly.map((w) => ({
                  ...w,
                  label: format(parseISO(w.weekStart), "d MMM"),
                }))}
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
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
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
                />
                <Bar
                  dataKey="newShops"
                  name="New shops"
                  fill="var(--muted-foreground)"
                  fillOpacity={0.4}
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="payingShops"
                  name="Paying"
                  fill="var(--primary)"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      <Card className="gap-4 p-5 md:p-6">
        <div>
          <h2 className="font-sans text-base font-semibold">
            Recent subscription payments
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Confirmed by the Fincra webhook.
          </p>
        </div>
        {payments.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : payments.isError ? (
          <MonitoringUnavailable onRetry={payments.retry} />
        ) : !payments.data || payments.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subscription payments yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paid</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Reference
                </TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(p.paidAt), "dd MMM HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">{p.tenantName}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {p.reference}
                  </TableCell>
                  <TableCell>{p.planCode ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmt(p.amount, p.currency, 2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
