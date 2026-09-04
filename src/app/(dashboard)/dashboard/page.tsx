import Link from "next/link";
import { ClipboardList, TrendingUp, Users, CheckSquare, BarChart3 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OutstandingBanner } from "@/components/dashboard/OutstandingBanner";
import { StatusPills } from "@/components/dashboard/StatusPills";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { RevenueBarChart, type RevenuePoint } from "@/components/dashboard/RevenueBarChart";
import { bucketMonthly, currencyNGN, lastNMonths, PIPELINE_STATUSES } from "@/lib/reports/analytics";

function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const months = lastNMonths(6);
  const sixMonthsAgo = `${months[0]!.key}-01`;

  const [
    { count: totalOrders },
    { count: ordersInProgress },
    { data: allOrderStatuses },
    { data: dueSoon },
    { count: pendingTasks },
    { count: tasksCompletedToday },
    { data: monthlyPayments },
    { data: outstandingOrders },
    { count: activeWorkers },
    { data: inProgressAssignees },
    { data: ordersForChart },
    { data: paymentsForChart },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("orders").select("status"),
    supabase
      .from("report_orders_due")
      .select("id, order_number, customer_name, due_date, balance_due, status")
      .order("due_date", { ascending: true })
      .limit(6),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").gte("completed_at", today),
    supabase.from("payments").select("amount").eq("direction", "customer_payment").gte("paid_at", monthStart),
    supabase.from("orders").select("total_amount, discount, amount_paid, status").neq("status", "cancelled"),
    supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("tasks").select("assigned_to").in("status", ["assigned", "in_progress"]).not("assigned_to", "is", null),
    supabase.from("orders").select("total_amount, created_at").gte("created_at", sixMonthsAgo),
    supabase.from("payments").select("amount, paid_at").eq("direction", "customer_payment").gte("paid_at", sixMonthsAgo),
  ]);

  const monthRevenue = (monthlyPayments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = (outstandingOrders ?? []).reduce((sum, o) => sum + (o.total_amount - o.discount - o.amount_paid), 0);
  const openOrdersCount = (outstandingOrders ?? []).filter((o) => o.total_amount - o.discount - o.amount_paid > 0).length;

  const statusCounts: Record<string, number> = {};
  for (const status of PIPELINE_STATUSES) statusCounts[status] = 0;
  for (const o of allOrderStatuses ?? []) {
    if (o.status in statusCounts) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }

  const workersWithActiveTasks = new Set((inProgressAssignees ?? []).map((t) => t.assigned_to)).size;

  const billed = bucketMonthly(ordersForChart ?? [], "created_at", "total_amount", months);
  const collected = bucketMonthly(paymentsForChart ?? [], "paid_at", "amount", months);
  const revenueData: RevenuePoint[] = months.map((m, i) => ({ label: m.label, billed: billed[i]!, collected: collected[i]! }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-serif text-slate-900">
          {greeting()}, {user.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-slate-500">Here&apos;s what&apos;s happening in your shop.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Total orders" value={String(totalOrders ?? 0)} hint={`${ordersInProgress ?? 0} in progress`} icon={ClipboardList} />
        <StatsCard
          label="Revenue this month"
          value={currencyNGN(monthRevenue)}
          hint={`${currencyNGN(totalOutstanding)} outstanding`}
          icon={TrendingUp}
        />
        <StatsCard
          label="Active workers"
          value={String(activeWorkers ?? 0)}
          hint={`${workersWithActiveTasks} with active tasks`}
          icon={Users}
        />
        <StatsCard label="Pending tasks" value={String(pendingTasks ?? 0)} hint={`${tasksCompletedToday ?? 0} completed today`} icon={CheckSquare} />
      </div>

      <OutstandingBanner amount={totalOutstanding} openOrders={openOrdersCount} />

      <StatusPills counts={statusCounts} />

      <ChartCard title="Revenue — Last 6 Months" icon={BarChart3}>
        <RevenueBarChart data={revenueData} />
      </ChartCard>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium text-slate-800">Orders due soon</h2>
          <Link href="/reports" className="text-sm text-brand-600 hover:underline">
            Full reports →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dueSoon?.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{o.customer_name}</td>
                  <td className="px-4 py-2 text-slate-600">{o.due_date ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-2 text-right">{o.balance_due.toFixed(2)}</td>
                </tr>
              ))}
              {dueSoon?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nothing due — you're all caught up.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
