import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { NewInventoryItemDialog } from "@/components/inventory/NewInventoryItemDialog";
import { InventoryItemRow } from "@/components/inventory/InventoryItemRow";

export default async function InventoryPage() {
  await requireCurrentUser();
  const supabase = createServerSupabase();

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, name, sku, unit, quantity_on_hand, reorder_threshold, unit_cost, supplier, is_active")
    .order("name");

  const lowStockCount = items?.filter((i) => i.is_active && i.quantity_on_hand <= i.reorder_threshold).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">
            Fabric and material stock.{" "}
            {lowStockCount > 0 && <span className="font-medium text-amber-700">{lowStockCount} item(s) low on stock.</span>}
          </p>
        </div>
        <NewInventoryItemDialog />
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">On hand</th>
              <th className="px-4 py-3">Unit cost</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((item) => (
              <InventoryItemRow key={item.id} item={item} />
            ))}
            {items?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No inventory items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
