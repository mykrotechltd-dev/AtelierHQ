"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadGalleryPhoto } from "@/app/(dashboard)/gallery/actions";

type Order = { id: string; order_number: string };

export function UploadPhotoForm({ orders, defaultOrderId }: { orders: Order[]; defaultOrderId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await uploadGalleryPhoto(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="block text-xs text-slate-500">Photo</label>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Caption</label>
        <input name="caption" placeholder="e.g. Wedding agbada, finished" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Link to order (optional)</label>
        <select name="order_id" defaultValue={defaultOrderId ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">None</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.order_number}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
        {pending ? "Uploading…" : "Upload photo"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
