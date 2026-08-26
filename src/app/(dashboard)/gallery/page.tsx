import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { UploadPhotoForm } from "@/components/gallery/UploadPhotoForm";
import { DeletePhotoButton } from "@/components/gallery/DeletePhotoButton";

export default async function GalleryPage({ searchParams }: { searchParams: { order_id?: string } }) {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  let photosQuery = supabase
    .from("gallery_photos")
    .select("id, storage_path, caption, created_at, orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(60);

  if (searchParams.order_id) {
    photosQuery = photosQuery.eq("order_id", searchParams.order_id);
  }

  const [{ data: photos }, { data: orders }] = await Promise.all([
    photosQuery,
    supabase.from("orders").select("id, order_number").order("created_at", { ascending: false }).limit(100),
  ]);

  // Bucket is private, so every photo needs its own short-lived signed URL —
  // there is no public path to fall back to.
  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-serif text-slate-900">Work gallery</h1>
        <p className="text-sm text-slate-500">Photos of finished projects.</p>
      </div>

      <UploadPhotoForm orders={orders ?? []} defaultOrderId={searchParams.order_id} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photosWithUrls.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {p.url && (
              // Plain <img>, not next/image: the URL is a short-lived signed
              // Supabase Storage URL with a query string, which doesn't play
              // well with the Next.js image optimizer's caching assumptions.
              <img src={p.url} alt={p.caption ?? "Work gallery photo"} className="h-40 w-full object-cover" />
            )}
            <div className="space-y-1 p-2">
              {p.caption && <p className="text-xs text-slate-600">{p.caption}</p>}
              {p.orders?.[0]?.order_number && <p className="text-xs text-slate-400">{p.orders[0].order_number}</p>}
              <DeletePhotoButton photoId={p.id} />
            </div>
          </div>
        ))}
        {photosWithUrls.length === 0 && <p className="col-span-full text-sm text-slate-400">No photos yet.</p>}
      </div>
    </div>
  );
}
