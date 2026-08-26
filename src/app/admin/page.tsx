import { createAdminSupabase } from "@/lib/supabase/admin";

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  // Safe to use the service-role client here — this page only renders after
  // requirePlatformAdmin() (in admin/layout.tsx) has already verified the
  // caller's identity via their own session. See src/lib/utils/admin.ts.
  const admin = createAdminSupabase();

  const [{ data: tenants }, { count: customerCount }, { count: orderCount }, { data: payments }, { data: activity }] =
    await Promise.all([
      admin.from("tenants").select("id, name, plan, subscription_status, created_at").order("created_at", { ascending: false }),
      admin.from("customers").select("*", { count: "exact", head: true }),
      admin.from("orders").select("*", { count: "exact", head: true }),
      // Fetched in full and summed client-side — fine at early-stage volume.
      // Once payment rows number in the tens of thousands, replace this with
      // a guarded SQL aggregate function (is_platform_admin()-checked, like
      // is_platform_admin() itself) rather than fetching every row.
      admin.from("payments").select("amount").eq("direction", "customer_payment"),
      admin
        .from("audit_logs")
        .select("id, action, entity_table, created_at, tenants(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const allTenants = tenants ?? [];
  const totalRevenue = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const newLast7 = allTenants.filter((t) => new Date(t.created_at).getTime() >= sevenDaysAgo).length;
  const newLast30 = allTenants.filter((t) => new Date(t.created_at).getTime() >= thirtyDaysAgo).length;

  const byPlan = allTenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.plan] = (acc[t.plan] ?? 0) + 1;
    return acc;
  }, {});
  const byStatus = allTenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.subscription_status] = (acc[t.subscription_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Platform overview</h1>
        <p className="text-sm text-slate-400">Every tenant shop on AtelierHQ, aggregated.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat label="Total shops (tenants)" value={String(allTenants.length)} />
        <AdminStat label="Total customers (all shops)" value={String(customerCount ?? 0)} />
        <AdminStat label="Total orders (all shops)" value={String(orderCount ?? 0)} />
        <AdminStat label="Total revenue collected" value={totalRevenue.toLocaleString(undefined, { style: "currency", currency: "NGN" })} />
        <AdminStat label="New shops (7 days)" value={String(newLast7)} />
        <AdminStat label="New shops (30 days)" value={String(newLast30)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 font-medium text-white">Plan breakdown</h2>
          <div className="space-y-1.5 text-sm">
            {Object.entries(byPlan).map(([plan, count]) => (
              <div key={plan} className="flex justify-between text-slate-300">
                <span className="capitalize">{plan}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
          <h2 className="mb-3 mt-5 font-medium text-white">Subscription status</h2>
          <div className="space-y-1.5 text-sm">
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between text-slate-300">
                <span className="capitalize">{status}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 font-medium text-white">Recent activity (order status changes, all shops)</h2>
          <div className="space-y-2 text-sm">
            {activity?.map((a) => (
              <div key={a.id} className="flex justify-between border-b border-slate-800 pb-1.5 text-slate-300 last:border-0">
                <span>
                  {/* @ts-expect-error — service-role client is untyped; single FK path (audit_logs.tenant_id -> tenants.id) makes this a plain object, not an array */}
                  {a.tenants?.name ?? "—"} · {a.action}
                </span>
                <span className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
            {activity?.length === 0 && <p className="text-slate-500">No activity recorded yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
