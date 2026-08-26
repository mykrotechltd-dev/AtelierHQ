"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInventoryItem } from "@/app/(dashboard)/inventory/actions";

export function NewInventoryItemDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createInventoryItem(formData);
    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
        + New item
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">New inventory item</h2>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <input name="name" placeholder="Fabric/material name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="sku" placeholder="SKU (optional)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500">Unit</label>
              <select name="unit" defaultValue="yards" className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="yards">Yards</option>
                <option value="meters">Meters</option>
                <option value="pieces">Pieces</option>
                <option value="rolls">Rolls</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Quantity on hand</label>
              <input name="quantity_on_hand" type="number" step="0.01" defaultValue={0} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Reorder threshold</label>
              <input name="reorder_threshold" type="number" step="0.01" defaultValue={0} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Unit cost</label>
              <input name="unit_cost" type="number" step="0.01" defaultValue={0} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          </div>

          <input name="supplier" placeholder="Supplier (optional)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="notes" placeholder="Notes" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {pending ? "Saving…" : "Save item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
