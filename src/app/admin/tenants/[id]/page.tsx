import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";

export default async function AdminTenantDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminSupabase();

  const [{ data: tenant }, { data: staff }, { data: customers }, { data: orders }, { data: payments }] = await Promise.all([
    admin.from("tenants").select("*").eq("id", params.id).single(),
    admin.from("profiles").select("id, full_name, role, is_active, created_at").eq("tenant_id", params.id).order("created_at"),
    admin.from("customers").select("id, full_name, phone, email, created_at").eq("tenant_id", params.id).order("created_at", { ascending: false }).limit(200),
    admin.from("orders").select("id, order_number, status, total_amount, amount_paid").eq("tenant_id", params.id).order("created_at", { ascending: false }).limit(50),
    admin.from("payments").select("amount").eq("tenant_id", params.id).eq("direction", "customer_payment"),
  ]);

  if (!tenant) notFound();

  const revenue = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">{tenant.name}</h1>
        <p className="text-sm text-slate-400">
          {tenant.phone ?? "no phone"} · {tenant.currency} · plan: {tenant.plan} ({tenant.subscription_status})
        </p>
        <p className="text-sm text-slate-400">Signed up {new Date(tenant.created_at).toLocaleDateString()}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Customers</p>
          <p className="text-xl font-semibold text-white">{customers?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Orders (last 50 shown)</p>
          <p className="text-xl font-semibold text-white">{orders?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Revenue collected</p>
          <p className="text-xl font-semibold text-white">{revenue.toLocaleString(undefined, { style: "currency", currency: tenant.currency ?? "NGN" })}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-white">Staff</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {staff?.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">{s.full_name}</td>
                  <td className="px-4 py-2 capitalize">{s.role}</td>
                  <td className="px-4 py-2">{s.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-white">Customers</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {customers?.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">{c.full_name}</td>
                  <td className="px-4 py-2">{c.phone}</td>
                  <td className="px-4 py-2">{c.email ?? "—"}</td>
                  <td className="px-4 py-2">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {customers?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
