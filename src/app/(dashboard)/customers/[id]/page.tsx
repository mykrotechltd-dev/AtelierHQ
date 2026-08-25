import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MeasurementForm } from "@/components/customers/MeasurementForm";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const [{ data: customer }, { data: measurements }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).single(),
    supabase.from("measurements").select("*").eq("customer_id", params.id).order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, order_number, status, due_date, total_amount, amount_paid")
      .eq("customer_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
        <p className="text-sm text-slate-500">
          {customer.phone} {customer.email ? `· ${customer.email}` : ""}
        </p>
        {customer.address && <p className="text-sm text-slate-500">{customer.address}</p>}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-slate-800">Orders</h2>
          <Link href={`/orders/new?customer_id=${customer.id}`} className="text-sm text-brand-600 hover:underline">
            + New order for this customer
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Order #</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders?.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-medium">{o.order_number}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{o.due_date ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {(o.total_amount - o.amount_paid).toLocaleString(undefined, { style: "currency", currency: "NGN" })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium text-slate-800">Measurements</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {measurements?.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-medium capitalize text-slate-800">
                {m.garment_type} {m.label ? `— ${m.label}` : ""}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                {Object.entries(m.values as Record<string, unknown>).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="capitalize text-slate-400">{k.replace(/_/g, " ")}</dt>
                    <dd>
                      {String(v)} {m.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <MeasurementForm customerId={customer.id} />
      </section>
    </div>
  );
}
