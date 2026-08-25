import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";

export default async function ReportsPage() {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ data: daily }, { data: dailyPayments }, { data: monthly }, { data: dueOrders }] = await Promise.all([
    supabase.from("report_daily").select("*").gte("day", thirtyDaysAgo).order("day", { ascending: false }),
    supabase.from("report_daily_payments").select("*").gte("day", thirtyDaysAgo).order("day", { ascending: false }),
    supabase.from("report_monthly_sales").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("report_orders_due").select("*").order("due_date", { ascending: true }),
  ]);

  // Merge the two daily views by day for a single table.
  const dayMap = new Map<string, { orders: number; grossValue: number; collected: number; paidOut: number }>();
  for (const d of daily ?? []) {
    dayMap.set(d.day, { orders: d.orders_created, grossValue: d.gross_value ?? 0, collected: 0, paidOut: 0 });
  }
  for (const p of dailyPayments ?? []) {
    const row = dayMap.get(p.day) ?? { orders: 0, grossValue: 0, collected: 0, paidOut: 0 };
    row.collected = p.collected ?? 0;
    row.paidOut = p.paid_out ?? 0;
    dayMap.set(p.day, row);
  }
  const dailyRows = Array.from(dayMap.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Daily orders/payments, monthly sales, and orders due.</p>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Daily orders & payments (last 30 days)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Day</th>
                <th className="px-4 py-2 text-right">Orders created</th>
                <th className="px-4 py-2 text-right">Order value</th>
                <th className="px-4 py-2 text-right">Collected</th>
                <th className="px-4 py-2 text-right">Worker payouts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyRows.map(([day, row]) => (
                <tr key={day}>
                  <td className="px-4 py-2">{day}</td>
                  <td className="px-4 py-2 text-right">{row.orders}</td>
                  <td className="px-4 py-2 text-right">{row.grossValue.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{row.collected.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-amber-700">{row.paidOut.toFixed(2)}</td>
                </tr>
              ))}
              {dailyRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No activity in the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Monthly sales</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2 text-right">Total collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthly?.map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-2">{new Date(m.month).toLocaleDateString(undefined, { year: "numeric", month: "long" })}</td>
                  <td className="px-4 py-2 text-right">{(m.total_collected ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Orders due (all open orders, by due date)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Balance due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dueOrders?.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-medium">{o.order_number}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {o.customer_name} · {o.customer_phone}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{o.due_date ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{o.balance_due.toFixed(2)}</td>
                </tr>
              ))}
              {dueOrders?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No open orders.
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
