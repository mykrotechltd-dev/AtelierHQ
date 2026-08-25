import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ORDER_STATUSES } from "@/lib/validations/order";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  let query = supabase
    .from("orders")
    .select("id, order_number, status, due_date, total_amount, amount_paid, customers(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  const { data: orders, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">Received → in progress → completed → delivered.</p>
        </div>
        <Link href="/orders/new" className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
          + New order
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href="/orders"
          className={`rounded-full px-3 py-1 ${!searchParams.status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/orders?status=${s}`}
            className={`rounded-full px-3 py-1 capitalize ${searchParams.status === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders?.map((o) => {
              // Untyped Supabase client infers embedded relations as arrays
              // (it can't see the foreign key's cardinality without generated
              // types); an order always has exactly one customer.
              const customer = o.customers?.[0];
              const balance = o.total_amount - o.amount_paid;
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-600">{customer?.full_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.due_date ?? "—"}</td>
                  <td className={`px-4 py-3 ${balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {balance.toLocaleString(undefined, { style: "currency", currency: "NGN" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {orders?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No orders match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
