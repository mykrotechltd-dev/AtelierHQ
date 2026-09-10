import { useMyTenant } from "@/lib/queries/tenants.ts";
import {
  useDashboardStats,
  useRevenueByMonth,
} from "@/lib/queries/analytics.ts";
import PageHeader from "@/components/page-header.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  ClipboardList,
  Users,
  TrendingUp,
  Wallet,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Dashboard() {
  const tenant = useMyTenant();
  const stats = useDashboardStats();
  const revenue = useRevenueByMonth();

  const currency = tenant?.currency ?? "USD";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const navigate = useNavigate();

  const isLoading =
    stats === undefined || revenue === undefined || tenant === undefined;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title={`${greeting}${tenant ? ", " + tenant.name : ""}`}
        description="Here's what's happening in your shop."
      />

      {/* KPI row */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Orders"
              value={String(stats.totalOrders)}
              sub={`${stats.orderCounts.in_progress} in progress`}
              icon={ClipboardList}
              onClick={() => navigate("/orders")}
            />
            <KpiCard
              label="Revenue This Month"
              value={fmt(stats.revenueThisMonth, currency)}
              sub={`${fmt(stats.totalOutstanding, currency)} outstanding`}
              icon={TrendingUp}
              onClick={() => navigate("/payments")}
            />
            <KpiCard
              label="Active Workers"
              value={String(stats.activeWorkers)}
              sub={`${stats.tasksInProgress} tasks in progress`}
              icon={Users}
              onClick={() => navigate("/workers")}
            />
            <KpiCard
              label="Pending Tasks"
              value={String(stats.tasksPending)}
              sub={`${stats.tasksDone} completed`}
              icon={CheckSquare}
              onClick={() => navigate("/tasks")}
            />
          </div>

          {/* Outstanding alert */}
          {stats.totalOutstanding > 0 && (
            <div
              className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm cursor-pointer"
              onClick={() => navigate("/payments")}
            >
              <AlertCircle className="size-4 text-yellow-500 shrink-0" />
              <span className="text-foreground/80">
                <strong className="text-foreground">
                  {fmt(stats.totalOutstanding, currency)}
                </strong>{" "}
                outstanding across{" "}
                {stats.orderCounts.received +
                  stats.orderCounts.in_progress +
                  stats.orderCounts.completed}{" "}
                open orders. Click to review payments.
              </span>
            </div>
          )}

          {/* Order status breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(
              [
                { label: "Received", key: "received", color: "bg-blue-500" },
                {
                  label: "In Progress",
                  key: "in_progress",
                  color: "bg-amber-500",
                },
                {
                  label: "Completed",
                  key: "completed",
                  color: "bg-emerald-500",
                },
                {
                  label: "Delivered",
                  key: "delivered",
                  color: "bg-muted-foreground",
                },
              ] as const
            ).map(({ label, key, color }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => navigate(`/orders?status=${key}`)}
              >
                <div className={`w-2 h-8 rounded-full ${color}`} />
                <div>
                  <p className="text-2xl font-bold font-display">
                    {stats.orderCounts[key]}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Revenue — Last 6 Months
                </CardTitle>
              </div>
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
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      fmt(Number(value), currency),
                      name === "billed" ? "Billed" : "Collected",
                    ]}
                  />
                  <Bar
                    dataKey="billed"
                    fill="rgba(28,40,80,0.22)"
                    radius={[4, 4, 0, 0]}
                    name="billed"
                  />
                  <Bar
                    dataKey="collected"
                    fill="#1c2850"
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
                  <span className="inline-block w-3 h-2 rounded bg-muted-foreground/30" />{" "}
                  Billed
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-1 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-2xl font-bold font-display">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
