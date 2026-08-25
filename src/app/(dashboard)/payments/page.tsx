import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { WorkerPayoutForm } from "@/components/orders/WorkerPayoutForm";

export default async function PaymentsPage() {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const [{ data: payments }, { data: workers }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, direction, amount, method, paid_at, notes, orders(order_number), workers(full_name)")
      .order("paid_at", { ascending: false })
      .limit(200),
    supabase.from("workers").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  const collected = payments?.filter((p) => p.direction === "customer_payment") ?? [];
  const payouts = payments?.filter((p) => p.direction === "worker_payout") ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">Customer collections and worker payouts.</p>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Customer payments</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collected.map((p) => (
                <tr key={p.id}>
                  {/* @ts-expect-error loosened join type */}
                  <td className="px-4 py-2 font-medium">{p.orders?.order_number}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">{p.method.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-slate-600">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right font-medium">{p.amount.toFixed(2)}</td>
                </tr>
              ))}
              {collected.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Worker payouts</h2>
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Worker</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map((p) => (
                <tr key={p.id}>
                  {/* @ts-expect-error loosened join type */}
                  <td className="px-4 py-2 font-medium">{p.workers?.full_name}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">{p.method.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-slate-600">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right font-medium">{p.amount.toFixed(2)}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No payouts recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <WorkerPayoutForm workers={workers ?? []} />
      </section>
    </div>
  );
}
