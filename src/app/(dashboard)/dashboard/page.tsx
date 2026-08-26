import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [{ count: ordersToday }, { data: dueSoon }, { data: pendingTasks }, { data: monthlyPayments }, { data: outstanding }] =
    await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase
        .from("report_orders_due")
        .select("id, order_number, customer_name, due_date, balance_due, status")
        .order("due_date", { ascending: true })
        .limit(6),
      supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["pending", "assigned", "in_progress"]),
      supabase.from("payments").select("amount").eq("direction", "customer_payment").gte("paid_at", monthStart),
      supabase.from("orders").select("total_amount, discount, amount_paid").neq("status", "cancelled"),
    ]);

  const monthRevenue = (monthlyPayments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = (outstanding ?? []).reduce((sum, o) => sum + (o.total_amount - o.discount - o.amount_paid), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold font-serif text-slate-900">Welcome back, {user.fullName.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">{user.tenantName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Orders today" value={String(ordersToday ?? 0)} />
        <StatsCard label="Revenue this month" value={monthRevenue.toLocaleString(undefined, { style: "currency", currency: "NGN" })} />
        <StatsCard label="Outstanding balance" value={totalOutstanding.toLocaleString(undefined, { style: "currency", currency: "NGN" })} />
        <StatsCard label="Tasks in progress" value={String(pendingTasks ?? 0)} />
      </div>

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
