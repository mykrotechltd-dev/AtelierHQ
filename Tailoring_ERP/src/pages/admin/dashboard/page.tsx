import { useAdminDashboardStats } from "@/lib/queries/admin.ts";
import PageHeader from "@/components/page-header.tsx";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Wallet,
  ClipboardList,
  CalendarClock,
  PackageMinus,
} from "lucide-react";

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminDashboard() {
  const stats = useAdminDashboardStats();
  const isLoading = stats === undefined;

  const revenue = stats?.revenueByCurrency ?? [];
  const primary = [...revenue].sort((a, b) => b.month - a.month)[0];
  const others = primary
    ? revenue.filter((r) => r.currency !== primary.currency)
    : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Platform Overview"
        description="Metrics across every AtelierHQ shop."
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Revenue"
            icon={Wallet}
            value={primary ? fmt(primary.month, primary.currency) : "—"}
            sub={
              primary
                ? `${fmt(primary.today, primary.currency)} today · ${fmt(primary.week, primary.currency)} this week`
                : "No payments recorded yet"
            }
            footnote={
              others.length > 0
                ? `+ ${others.map((o) => fmt(o.month, o.currency)).join(", ")} this month`
                : undefined
            }
          />
          <KpiCard
            label="Active Orders"
            icon={ClipboardList}
            value={String(stats.activeOrders)}
            sub="Received or in progress"
          />
          <KpiCard
            label="Pending Fittings"
            icon={CalendarClock}
            value={String(stats.fittingsToday)}
            sub={`${stats.fittingsThisWeek} scheduled this week`}
          />
          <KpiCard
            label="Low Inventory"
            icon={PackageMinus}
            value={String(stats.lowInventoryCount)}
            sub="Items at or below reorder threshold"
          />
        </div>
      )}
    </div>
  );
}

function KpiCard({
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
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-2xl font-bold font-display">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        {footnote && (
          <p className="text-[11px] text-muted-foreground/70 mt-1 truncate">
            {footnote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
