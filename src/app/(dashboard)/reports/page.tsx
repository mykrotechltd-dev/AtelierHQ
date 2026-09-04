import { Wallet, CheckCircle2, AlertTriangle, BarChart3, PieChart as PieChartIcon, Users2 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { RevenueBarChart, type RevenuePoint } from "@/components/dashboard/RevenueBarChart";
import { StatusDonut } from "@/components/dashboard/StatusDonut";
import { TopCustomersBarChart, type CustomerPoint } from "@/components/dashboard/TopCustomersBarChart";
import { WorkerPerformanceTable, type WorkerPerformanceRow } from "@/components/dashboard/WorkerPerformanceTable";
import { bucketMonthly, currencyNGN, lastNMonths, PIPELINE_STATUSES } from "@/lib/reports/analytics";

export default async function ReportsPage() {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const months = lastNMonths(6);
  const sixMonthsAgo = `${months[0]!.key}-01`;

  const [
    { data: billingOrders },
    { data: collectedPayments },
    { data: allOrderStatuses },
    { data: ordersForChart },
    { data: paymentsForChart },
    { data: customerOrders },
    { data: workerPerf },
    { data: workers },
    { data: pendingTasks },
  ] = await Promise.all([
    supabase.from("orders").select("total_amount, discount, amount_paid").neq("status", "cancelled"),
    supabase.from("payments").select("amount").eq("direction", "customer_payment"),
    supabase.from("orders").select("status"),
    supabase.from("orders").select("total_amount, created_at").gte("created_at", sixMonthsAgo),
    supabase.from("payments").select("amount, paid_at").eq("direction", "customer_payment").gte("paid_at", sixMonthsAgo),
    supabase.from("orders").select("customer_id, total_amount, customers(full_name)").neq("status", "cancelled"),
    supabase.from("report_worker_performance").select("*").order("tasks_completed", { ascending: false }),
    supabase.from("workers").select("id, specialties"),
    supabase.from("tasks").select("assigned_to").eq("status", "pending").not("assigned_to", "is", null),
  ]);

  const totalBilled = (billingOrders ?? []).reduce((sum, o) => sum + o.total_amount, 0);
  const totalCollected = (collectedPayments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = (billingOrders ?? []).reduce((sum, o) => sum + (o.total_amount - o.discount - o.amount_paid), 0);

  const statusCounts: Record<string, number> = {};
  for (const status of PIPELINE_STATUSES) statusCounts[status] = 0;
  for (const o of allOrderStatuses ?? []) {
    if (o.status in statusCounts) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }

  const billed = bucketMonthly(ordersForChart ?? [], "created_at", "total_amount", months);
  const collected = bucketMonthly(paymentsForChart ?? [], "paid_at", "amount", months);
  const revenueData: RevenuePoint[] = months.map((m, i) => ({ label: m.label, billed: billed[i]!, collected: collected[i]! }));

  const byCustomer = new Map<string, { name: string; total: number }>();
  for (const o of customerOrders ?? []) {
    // Supabase's client types a to-one joined relation as an array here
    // (same shape this app already relies on at /patterns/[orderItemId] —
    // `order.customers?.[0]`), not a bare object, despite it always being at
    // most one row per order.
    const joined = o.customers as unknown as { full_name: string }[] | null;
    const name = joined?.[0]?.full_name ?? "Unknown";
    const row = byCustomer.get(o.customer_id) ?? { name, total: 0 };
    row.total += o.total_amount;
    byCustomer.set(o.customer_id, row);
  }
  const topCustomers: CustomerPoint[] = Array.from(byCustomer.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const pendingByWorker = new Map<string, number>();
  for (const t of pendingTasks ?? []) {
    if (!t.assigned_to) continue;
    pendingByWorker.set(t.assigned_to, (pendingByWorker.get(t.assigned_to) ?? 0) + 1);
  }
  const specialtiesByWorker = new Map((workers ?? []).map((w) => [w.id, w.specialties as string[]]));

  const workerRows: WorkerPerformanceRow[] = (workerPerf ?? []).map((w) => ({
    workerId: w.worker_id,
    fullName: w.full_name,
    specialization: specialtiesByWorker.get(w.worker_id)?.[0]?.replace("_", " ") ?? "—",
    tasksDone: w.tasks_completed,
    tasksInProgress: w.tasks_in_progress,
    tasksPending: pendingByWorker.get(w.worker_id) ?? 0,
    totalPaidOut: w.total_paid_out,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-serif text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Business analytics and performance overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard label="Total billed" value={currencyNGN(totalBilled)} icon={Wallet} />
        <StatsCard label="Total collected" value={currencyNGN(totalCollected)} icon={CheckCircle2} />
        <StatsCard label="Outstanding" value={currencyNGN(totalOutstanding)} icon={AlertTriangle} tone={totalOutstanding > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue Trend (6 months)" icon={BarChart3}>
          <RevenueBarChart data={revenueData} />
        </ChartCard>
        <ChartCard title="Orders by Status" icon={PieChartIcon}>
          <StatusDonut counts={statusCounts} />
        </ChartCard>
      </div>

      <ChartCard title="Top Customers by Order Value" icon={Users2}>
        <TopCustomersBarChart data={topCustomers} />
      </ChartCard>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Worker Performance</h2>
        <WorkerPerformanceTable rows={workerRows} />
      </section>
    </div>
  );
}
