"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateInventoryItem, setInventoryItemActive } from "@/app/(dashboard)/inventory/actions";

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  unit_cost: number;
  supplier: string | null;
  is_active: boolean;
};

export function InventoryItemRow({ item }: { item: Item }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const lowStock = item.quantity_on_hand <= item.reorder_threshold;

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("item_id", item.id);
    const result = await updateInventoryItem(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function toggleActive() {
    setPending(true);
    const fd = new FormData();
    fd.set("item_id", item.id);
    fd.set("is_active", String(!item.is_active));
    await setInventoryItemActive(fd);
    setPending(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className={!item.is_active ? "opacity-50" : ""}>
        <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
        <td className="px-4 py-3 text-slate-600">{item.sku ?? "—"}</td>
        <td className="px-4 py-3">
          <span className={lowStock ? "font-medium text-amber-700" : "text-slate-700"}>
            {item.quantity_on_hand} {item.unit}
          </span>
          {lowStock && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Low stock</span>}
        </td>
        <td className="px-4 py-3 text-slate-600">{item.unit_cost.toFixed(2)}</td>
        <td className="px-4 py-3 text-slate-600">{item.supplier ?? "—"}</td>
        <td className="px-4 py-3 text-right">
          <button onClick={() => setEditing(true)} className="mr-3 text-xs text-brand-600 hover:underline">
            Edit
          </button>
          <button onClick={toggleActive} disabled={pending} className="text-xs text-slate-500 hover:underline">
            {item.is_active ? "Archive" : "Restore"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="bg-slate-50 px-4 py-3">
        <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
          <input name="name" defaultValue={item.name} required className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Name" />
          <input name="sku" defaultValue={item.sku ?? ""} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="SKU" />
          <select name="unit" defaultValue={item.unit} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="yards">Yards</option>
            <option value="meters">Meters</option>
            <option value="pieces">Pieces</option>
            <option value="rolls">Rolls</option>
          </select>
          <input name="quantity_on_hand" type="number" step="0.01" defaultValue={item.quantity_on_hand} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Qty" />
          <input name="reorder_threshold" type="number" step="0.01" defaultValue={item.reorder_threshold} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Reorder at" />
          <input name="unit_cost" type="number" step="0.01" defaultValue={item.unit_cost} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Unit cost" />
          <input name="supplier" defaultValue={item.supplier ?? ""} className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Supplier" />
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
