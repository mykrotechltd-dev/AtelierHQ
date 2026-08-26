import Link from "next/link";
import { createAdminSupabase } from "@/lib/supabase/admin";

export default async function AdminTenantsPage() {
  const admin = createAdminSupabase();

  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, name, phone, plan, subscription_status, created_at")
    .order("created_at", { ascending: false });

  // Per-tenant counts done as N+1 for simplicity — fine while tenant count is
  // small. Move to a single grouped aggregate query once this list grows large.
  const withCounts = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const [{ count: customerCount }, { count: orderCount }] = await Promise.all([
        admin.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
      ]);
      return { ...t, customerCount: customerCount ?? 0, orderCount: orderCount ?? 0 };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Tenants</h1>
        <p className="text-sm text-slate-400">Every tailoring shop subscribed to AtelierHQ.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error.message}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Customers</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {withCounts.map((t) => (
              <tr key={t.id} className="text-slate-300 hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                <td className="px-4 py-3">{t.phone ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{t.plan}</td>
                <td className="px-4 py-3 capitalize">{t.subscription_status}</td>
                <td className="px-4 py-3">{t.customerCount}</td>
                <td className="px-4 py-3">{t.orderCount}</td>
                <td className="px-4 py-3">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/tenants/${t.id}`} className="text-amber-400 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {withCounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No tenants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
