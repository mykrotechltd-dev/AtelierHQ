"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { recordPaymentSchema } from "@/lib/validations/order";

export async function recordPayment(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const parsed = recordPaymentSchema.safeParse({
    order_id: formData.get("order_id"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid payment" };

  // Guard against overpayment: fetch the order's current balance first.
  const { data: order } = await supabase
    .from("orders")
    .select("total_amount, discount, amount_paid")
    .eq("id", parsed.data.order_id)
    .single();

  if (!order) return { error: "Order not found" };

  const balance = order.total_amount - order.discount - order.amount_paid;
  if (parsed.data.amount > balance + 0.01) {
    return { error: `Amount exceeds outstanding balance of ${balance.toFixed(2)}` };
  }

  const { error } = await supabase.from("payments").insert({
    tenant_id: user.tenantId,
    direction: "customer_payment",
    order_id: parsed.data.order_id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference || null,
    notes: parsed.data.notes || null,
    recorded_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/orders/${parsed.data.order_id}`);
  revalidatePath("/payments");
  return { success: true };
}

export async function recordWorkerPayout(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const workerId = formData.get("worker_id")?.toString();
  const amount = Number(formData.get("amount"));
  if (!workerId || !amount || amount <= 0) return { error: "Invalid payout" };

  const { error } = await supabase.from("payments").insert({
    tenant_id: user.tenantId,
    direction: "worker_payout",
    worker_id: workerId,
    amount,
    method: (formData.get("method")?.toString() as string) || "cash",
    notes: formData.get("notes")?.toString() || null,
    recorded_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/payments");
  return { success: true };
}
