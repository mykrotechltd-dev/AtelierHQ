"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { inventoryItemSchema } from "@/lib/validations/inventory";

function parseInventoryForm(formData: FormData) {
  return inventoryItemSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") ?? "",
    unit: formData.get("unit"),
    quantity_on_hand: formData.get("quantity_on_hand"),
    reorder_threshold: formData.get("reorder_threshold"),
    unit_cost: formData.get("unit_cost"),
    supplier: formData.get("supplier") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createInventoryItem(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const parsed = parseInventoryForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid item" };

  const { error } = await supabase.from("inventory_items").insert({ ...parsed.data, tenant_id: user.tenantId });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateInventoryItem(formData: FormData) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const itemId = formData.get("item_id")?.toString();
  if (!itemId) return { error: "Missing item" };

  const parsed = parseInventoryForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid item" };

  const { error } = await supabase.from("inventory_items").update(parsed.data).eq("id", itemId);
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { success: true };
}

export async function setInventoryItemActive(formData: FormData) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const itemId = formData.get("item_id")?.toString();
  const isActive = formData.get("is_active") === "true";
  if (!itemId) return { error: "Missing item" };

  const { error } = await supabase.from("inventory_items").update({ is_active: isActive }).eq("id", itemId);
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { success: true };
}
