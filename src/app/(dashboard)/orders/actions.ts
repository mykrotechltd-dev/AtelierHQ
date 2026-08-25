"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import {
  orderSchema,
  updateOrderStatusSchema,
  ALLOWED_STATUS_TRANSITIONS,
} from "@/lib/validations/order";

export async function createOrder(input: unknown) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }

  const { customer_id, due_date, discount, notes, items } = parsed.data;

  // create_order_with_items() is a SECURITY DEFINER RPC (see schema.sql) so the
  // order + all its items are created atomically and the order number is
  // allocated race-safely — two staff can't collide on ORD-0001 at once.
  const { data: orderId, error } = await supabase.rpc("create_order_with_items", {
    p_customer_id: customer_id,
    p_due_date: due_date || null,
    p_discount: discount,
    p_notes: notes || null,
    p_items: items,
  });

  if (error) return { error: error.message };

  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function updateOrderStatus(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const parsed = updateOrderStatusSchema.safeParse({
    order_id: formData.get("order_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", parsed.data.order_id)
    .single();

  if (!current) return { error: "Order not found" };

  const allowed = ALLOWED_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return { error: `Cannot move an order from "${current.status}" to "${parsed.data.status}"` };
  }

  const patch: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "delivered") patch.delivered_at = new Date().toISOString();

  const { error } = await supabase.from("orders").update(patch).eq("id", parsed.data.order_id);
  if (error) return { error: error.message };

  revalidatePath(`/orders/${parsed.data.order_id}`);
  revalidatePath("/orders");
  return { success: true };
}
