"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderItem } from "@/app/(dashboard)/orders/actions";

type Item = {
  id: string;
  garment_type: string;
  description: string | null;
  quantity: number;
  unit_price: number;
};

export function OrderItemRow({ orderId, item }: { orderId: string; item: Item }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("item_id", item.id);
    formData.set("order_id", orderId);
    const result = await updateOrderItem(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr>
        <td className="px-4 py-2 font-medium capitalize">{item.garment_type}</td>
        <td className="px-4 py-2 text-slate-600">{item.description ?? "—"}</td>
        <td className="px-4 py-2">{item.quantity}</td>
        <td className="px-4 py-2">{item.unit_price.toFixed(2)}</td>
        <td className="px-4 py-2">{(item.quantity * item.unit_price).toFixed(2)}</td>
        <td className="px-4 py-2 text-right">
          <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="bg-slate-50 px-4 py-3">
        <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500">Garment</label>
            <input name="garment_type" defaultValue={item.garment_type} required className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Description</label>
            <input name="description" defaultValue={item.description ?? ""} className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Qty</label>
            <input name="quantity" type="number" min={1} defaultValue={item.quantity} required className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Unit price</label>
            <input name="unit_price" type="number" step="0.01" min={0} defaultValue={item.unit_price} required className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </form>
      </td>
    </tr>
  );
}
