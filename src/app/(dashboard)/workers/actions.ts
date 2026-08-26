"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser, requireRole } from "@/lib/utils/tenant";
import { workerSchema } from "@/lib/validations/worker";

export async function createWorker(formData: FormData) {
  const user = await requireCurrentUser();
  // Matches the workers_all RLS policy in schema.sql: only owner/admin can
  // add/edit workers. requireRole() throws before we even hit the DB, so
  // the error message is clearer than a generic RLS-denied failure.
  try {
    requireRole(user, ["owner", "admin"]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Forbidden" };
  }

  const supabase = createServerSupabase();

  const parsed = workerSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") ?? "",
    specialties: formData.getAll("specialties"),
    pay_rate_type: formData.get("pay_rate_type"),
    pay_rate: formData.get("pay_rate"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid worker" };

  const { error } = await supabase.from("workers").insert({
    tenant_id: user.tenantId,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    specialties: parsed.data.specialties,
    pay_rate_type: parsed.data.pay_rate_type,
    pay_rate: parsed.data.pay_rate,
  });

  if (error) return { error: error.message };

  revalidatePath("/workers");
  revalidatePath("/orders"); // AssignTaskForm's worker dropdown is populated from order detail pages too
  return { success: true };
}

export async function setWorkerActive(formData: FormData) {
  const user = await requireCurrentUser();
  try {
    requireRole(user, ["owner", "admin"]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Forbidden" };
  }

  const supabase = createServerSupabase();
  const workerId = formData.get("worker_id")?.toString();
  const isActive = formData.get("is_active") === "true";
  if (!workerId) return { error: "Missing worker" };

  const { error } = await supabase.from("workers").update({ is_active: isActive }).eq("id", workerId);
  if (error) return { error: error.message };

  revalidatePath("/workers");
  return { success: true };
}
