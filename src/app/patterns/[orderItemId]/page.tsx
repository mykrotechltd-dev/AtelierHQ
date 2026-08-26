import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { PatternBlockTabs } from "@/components/patterns/PatternBlockTabs";

export default async function PatternChooserPage({ params }: { params: { orderItemId: string } }) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const { data: item } = await supabase
    .from("order_items")
    .select("id, garment_type, measurement_id, order_id, orders(order_number, customers(full_name))")
    .eq("id", params.orderItemId)
    .single();

  if (!item) notFound();

  const order = item.orders?.[0];
  const customer = order?.customers?.[0];

  const { data: measurement } = item.measurement_id
    ? await supabase.from("measurements").select("values, unit").eq("id", item.measurement_id).single()
    : { data: null };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href={`/orders/${item.order_id}`} className="text-sm text-brand-600 hover:underline">
          ← Back to order
        </Link>
        <h1 className="mt-2 text-xl font-semibold font-serif text-slate-900">Generate pattern</h1>
        <p className="text-sm text-slate-500">
          {order?.order_number} · {customer?.full_name} · <span className="capitalize">{item.garment_type}</span>
        </p>
      </div>

      {!item.measurement_id || !measurement ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          No measurement linked to this item yet. Go back to the order, click Edit on this item, and choose a measurement first.
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-700">Live preview — adjust sliders to explore, doesn't change what's saved</h2>
            <PatternBlockTabs
              initialValues={measurement.values as Record<string, string | number>}
              initialUnit={measurement.unit as "in" | "cm"}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              These PDFs use the <strong>saved measurement</strong>, not the sliders above. They're <strong>basic front blocks</strong> — a
              starting draft from a quarter-measurement formula, not a finished pattern. Add armhole/neckline curves, darts, seam allowance,
              and a back piece by hand before cutting fabric. Full details are on the PDF's cover page.
            </p>

            <a
              href={`/patterns/${item.id}/pdf?block=skirt`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-500 hover:bg-brand-50"
            >
              <p className="font-medium text-slate-800">Basic skirt block (front)</p>
              <p className="text-sm text-slate-500">Uses waist, hip, hip depth, skirt length from the linked measurement.</p>
            </a>

            <a
              href={`/patterns/${item.id}/pdf?block=bodice`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-500 hover:bg-brand-50"
            >
              <p className="font-medium text-slate-800">Basic bodice block (front)</p>
              <p className="text-sm text-slate-500">Uses bust/chest, waist, shoulder, bodice length from the linked measurement.</p>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
