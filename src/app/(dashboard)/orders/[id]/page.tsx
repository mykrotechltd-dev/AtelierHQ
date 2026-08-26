import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderStatusControl } from "@/components/orders/OrderStatusControl";
import { RecordPaymentForm } from "@/components/orders/RecordPaymentForm";
import { AssignTaskForm } from "@/components/orders/AssignTaskForm";
import { GenerateInvoiceButton } from "@/components/orders/GenerateInvoiceButton";
import { OrderItemRow } from "@/components/orders/OrderItemRow";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const [{ data: order }, { data: items }, { data: tasks }, { data: payments }, { data: workers }] = await Promise.all([
    supabase.from("orders").select("*, customers(id, full_name, phone, whatsapp_number)").eq("id", params.id).single(),
    supabase.from("order_items").select("*").eq("order_id", params.id).order("created_at"),
    supabase.from("tasks").select("*, workers(full_name)").eq("order_id", params.id).order("created_at"),
    supabase.from("payments").select("*").eq("order_id", params.id).eq("direction", "customer_payment").order("paid_at", { ascending: false }),
    supabase.from("workers").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  if (!order) notFound();

  const customer = order.customers;

  // Measurements belong to the order's customer, not the order itself — this
  // is what OrderItemRow's "link a measurement" dropdown and pattern
  // generation both read from.
  const { data: measurements } = customer
    ? await supabase
        .from("measurements")
        .select("id, garment_type, label")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const balance = order.total_amount - order.discount - order.amount_paid;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{order.order_number}</h1>
          <p className="text-sm text-slate-500">
            {customer?.full_name} · {customer?.phone}
          </p>
          {order.due_date && <p className="text-sm text-slate-500">Due {order.due_date}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/gallery?order_id=${order.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Gallery
          </Link>
          <GenerateInvoiceButton orderId={order.id} customerWhatsapp={customer?.whatsapp_number ?? customer?.phone} />
        </div>
      </div>

      <OrderStatusControl orderId={order.id} status={order.status} />

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Garment</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Unit price</th>
                <th className="px-4 py-2">Subtotal</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items?.map((it) => (
                <OrderItemRow key={it.id} orderId={order.id} item={it} measurements={measurements ?? []} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex justify-end gap-8 text-sm text-slate-600">
          <span>Total: <strong>{order.total_amount.toFixed(2)}</strong></span>
          <span>Discount: {order.discount.toFixed(2)}</span>
          <span>Paid: {order.amount_paid.toFixed(2)}</span>
          <span className={balance > 0 ? "text-amber-700" : "text-emerald-700"}>Balance: <strong>{balance.toFixed(2)}</strong></span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Tasks (cutting, stitching, embroidery, hand work…)</h2>
        <div className="mb-3 space-y-2">
          {tasks?.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="capitalize">
                {t.task_type.replace("_", " ")} — {t.workers?.full_name ?? "Unassigned"}
              </span>
              <div className="flex items-center gap-2">
                {t.due_date && <span className="text-xs text-slate-400">due {t.due_date}</span>}
                <StatusBadge status={t.status} />
              </div>
            </div>
          ))}
          {tasks?.length === 0 && <p className="text-sm text-slate-400">No tasks assigned yet.</p>}
        </div>
        {workers?.length === 0 && (
          <p className="mb-2 text-sm text-slate-400">
            No workers yet.{" "}
            <Link href="/workers" className="text-brand-600 hover:underline">
              Add one first →
            </Link>
          </p>
        )}
        <AssignTaskForm orderId={order.id} workers={workers ?? []} items={items ?? []} />
      </section>

      <section>
        <h2 className="mb-2 font-medium text-slate-800">Payments</h2>
        <div className="mb-3 space-y-1">
          {payments?.map((p) => (
            <div key={p.id} className="flex justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="capitalize">{p.method.replace("_", " ")}</span>
              <span>{new Date(p.paid_at).toLocaleDateString()}</span>
              <span className="font-medium">{p.amount.toFixed(2)}</span>
            </div>
          ))}
          {payments?.length === 0 && <p className="text-sm text-slate-400">No payments recorded yet.</p>}
        </div>
        <RecordPaymentForm orderId={order.id} balance={balance} total={order.total_amount} />
      </section>
    </div>
  );
}
