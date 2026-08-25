import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { OrderForm } from "@/components/orders/OrderForm";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: { customer_id?: string };
}) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .order("full_name")
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New order</h1>
        <p className="text-sm text-slate-500">Add one or more garments to this order.</p>
      </div>
      <OrderForm customers={customers ?? []} defaultCustomerId={searchParams.customer_id} />
    </div>
  );
}
