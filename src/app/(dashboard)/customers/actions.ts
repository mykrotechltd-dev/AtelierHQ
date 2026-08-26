"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { customerSchema, measurementSchema } from "@/lib/validations/customer";

export async function createCustomer(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const parsed = customerSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    whatsapp_number: formData.get("whatsapp_number") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // tenant_id is set explicitly, but RLS's `with check` on customers_all is
  // the actual enforcement — this insert fails closed if tenant_id were ever wrong.
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.data, tenant_id: user.tenantId, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation — customers_tenant_phone_unique fired
    if (error.code === "23505") {
      return { error: "A customer with this phone number already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { data };
}

export async function addMeasurement(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const rawValues = formData.get("values"); // JSON string built client-side from the dynamic field list
  let values: Record<string, string | number> = {};
  try {
    values = rawValues ? JSON.parse(rawValues.toString()) : {};
  } catch {
    return { error: "Invalid measurement values" };
  }

  const parsed = measurementSchema.safeParse({
    customer_id: formData.get("customer_id"),
    garment_type: formData.get("garment_type"),
    label: formData.get("label") ?? "",
    unit: formData.get("unit") ?? "in",
    values,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("measurements").insert({
    ...parsed.data,
    tenant_id: user.tenantId,
    recorded_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/customers/${parsed.data.customer_id}`);
  return { success: true };
}
