"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { assignTaskSchema } from "@/lib/validations/order";

export async function assignTask(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const parsed = assignTaskSchema.safeParse({
    order_id: formData.get("order_id"),
    order_item_id: formData.get("order_item_id") || null,
    task_type: formData.get("task_type"),
    assigned_to: formData.get("assigned_to"),
    due_date: formData.get("due_date") || null,
    pay_amount: formData.get("pay_amount") || 0,
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid task" };

  const { error } = await supabase.from("tasks").insert({
    ...parsed.data,
    tenant_id: user.tenantId,
    status: "assigned",
  });

  if (error) return { error: error.message };

  revalidatePath(`/orders/${parsed.data.order_id}`);
  revalidatePath("/tasks");
  return { success: true };
}

export async function updateTaskStatus(formData: FormData) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const taskId = formData.get("task_id")?.toString();
  const status = formData.get("status")?.toString();
  if (!taskId || !status) return { error: "Missing task or status" };

  const patch: Record<string, unknown> = { status };
  if (status === "in_progress") patch.started_at = new Date().toISOString();
  if (status === "done") patch.completed_at = new Date().toISOString();

  // RLS: staff+ can update any task in the tenant; a worker (logged in via
  // their own profile) can only update tasks assigned to them — see the
  // tasks_worker_update policy in schema.sql.
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}
