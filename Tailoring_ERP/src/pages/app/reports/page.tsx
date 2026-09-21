import { useMyTenant } from "@/lib/queries/tenants.ts";
import {
  useDashboardStats,
  useRevenueByMonth,
  useTopCustomers,
  useWorkerPerformance,
} from "@/lib/queries/analytics.ts";
import { formatCurrency as fmt } from "@/lib/format-currency.ts";
import PageHeader from "@/components/page-header.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Lightbulb } from "lucide-react";
import { insights } from "./insights.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  received: "var(--muted-foreground)",
  in_progress: "var(--primary)",
  completed: "var(--success)",
  delivered: "var(--border)",
};

export default function ReportsPage() {
  const tenant = useMyTenant();
  const stats = useDashboardStats();
  const revenue = useRevenueByMonth();
  const topCustomers = useTopCustomers();
  const workerPerf = useWorkerPerformance();

  const currency = tenant?.currency ?? "USD";
  const isLoading =
    stats === undefined ||
    revenue === undefined ||
    topCustomers === undefined ||
    workerPerf === undefined;

  const orderPieData = stats
    ? [
        {
          name: "Received",
          value: stats.orderCounts.received,
          key: "received",
        },
        {
          name: "In Progress",
          value: stats.orderCounts.in_progress,
          key: "in_progress",
        },
        {
          name: "Completed",
          value: stats.orderCounts.completed,
          key: "completed",
        },
        {
          name: "Delivered",
          value: stats.orderCounts.delivered,
          key: "delivered",
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Atelier intelligence"
        title="Reports"
        description="Business analytics and performance overview."
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* What stands out: plain-language findings from the numbers below */}
          <Card className="shadow-lg shadow-foreground/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4 text-primary" /> What stands out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-relaxed">
                {insights(stats, topCustomers, workerPerf, currency).map(
                  (line) => (
                    <li key={line}>{line}</li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SummaryCard
              label="Total Billed"
              value={fmt(stats.totalBilled, currency)}
            />
            <SummaryCard
              label="Total Collected"
              value={fmt(stats.totalCollected, currency)}
            />
            <SummaryCard
              label="Outstanding"
              value={fmt(stats.totalOutstanding, currency)}
              highlight={stats.totalOutstanding > 0}
            />
          </div>

          {/* Revenue trend + Order pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Revenue Trend (6 months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={revenue}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 11,
                        fill: "var(--muted-foreground)",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "var(--muted-foreground)",
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
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
                      fill="var(--muted-foreground)"
                      fillOpacity={0.35}
                      radius={[4, 4, 0, 0]}
                      name="billed"
                    />
                    <Bar
                      dataKey="collected"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                      name="collected"
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-2 rounded bg-primary" />{" "}
                    Collected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-2 rounded bg-muted-foreground/25" />{" "}
                    Billed
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Order status pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orders by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {orderPieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16">
                    No orders yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={orderPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {orderPieData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={STATUS_COLORS[entry.key]}
                          />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--muted-foreground)",
                            }}
                          >
                            {value}
                          </span>
                        )}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top customers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Top Customers by Order Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No customers yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={topCustomers}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    style={{ background: "transparent" }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{
                        fontSize: 11,
                        fill: "var(--muted-foreground)",
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={110}
                      tick={{ fontSize: 12, fill: "var(--foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value) => [
                        fmt(Number(value), currency),
                        "Total value",
                      ]}
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--primary)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Worker performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Worker Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {workerPerf.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workers yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left py-2 pr-4 font-medium">
                          Worker
                        </th>
                        <th className="text-left py-2 pr-4 font-medium">
                          Specialization
                        </th>
                        <th className="text-right py-2 pr-4 font-medium">
                          Tasks Done
                        </th>
                        <th className="text-right py-2 pr-4 font-medium">
                          In Progress
                        </th>
                        <th className="text-right py-2 pr-4 font-medium">
                          Pending
                        </th>
                        <th className="text-right py-2 font-medium">Payouts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerPerf
                        .filter((w) => w.isActive)
                        .sort((a, b) => b.done - a.done)
                        .map((w) => (
                          <tr key={w.name} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{w.name}</td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {w.specialization ?? "—"}
                            </td>
                            <td className="py-2 pr-4 text-right text-success font-medium">
                              {w.done}
                            </td>
                            <td className="py-2 pr-4 text-right text-warning">
                              {w.inProgress}
                            </td>
                            <td className="py-2 pr-4 text-right text-muted-foreground">
                              {w.pending}
                            </td>
                            <td className="py-2 text-right">
                              {fmt(w.payoutTotal, currency)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={
        highlight ? "border-warning/40 shadow-lg shadow-foreground/5" : ""
      }
    >
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </p>
        <p
          className={`text-2xl font-bold font-display mt-1 ${highlight ? "text-warning" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
