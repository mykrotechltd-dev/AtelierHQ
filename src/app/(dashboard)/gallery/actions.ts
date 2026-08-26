"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // matches next.config.js serverActions.bodySizeLimit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadGalleryPhoto(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload" };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: "Only JPEG, PNG or WebP images are allowed" };
  if (file.size > MAX_SIZE_BYTES) return { error: "Photo must be under 5MB" };

  const caption = formData.get("caption")?.toString() || null;
  const orderId = formData.get("order_id")?.toString() || null;

  const ext = file.name.split(".").pop() || "jpg";
  // Namespaced under the tenant folder, matching the attachments_tenant_rw
  // storage policy in schema.sql — first path segment must be the tenant id.
  const path = `${user.tenantId}/gallery/${nanoid()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("attachments").upload(path, buffer, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("gallery_photos").insert({
    tenant_id: user.tenantId,
    order_id: orderId,
    storage_path: path,
    caption,
    created_by: user.id,
  });

  if (error) {
    await supabase.storage.from("attachments").remove([path]); // don't leave an orphaned file
    return { error: error.message };
  }

  revalidatePath("/gallery");
  return { success: true };
}

export async function deleteGalleryPhoto(formData: FormData) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const photoId = formData.get("photo_id")?.toString();
  if (!photoId) return { error: "Missing photo" };

  const { data: photo } = await supabase.from("gallery_photos").select("storage_path").eq("id", photoId).single();
  if (!photo) return { error: "Photo not found" };

  await supabase.storage.from("attachments").remove([photo.storage_path]);

  const { error } = await supabase.from("gallery_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };

  revalidatePath("/gallery");
  return { success: true };
}
