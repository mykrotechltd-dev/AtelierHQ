import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { NewWorkerDialog } from "@/components/workers/NewWorkerDialog";
import { WorkerActiveToggle } from "@/components/workers/WorkerActiveToggle";

export default async function WorkersPage() {
  const user = await requireCurrentUser();
  const supabase = createServerSupabase();

  const { data: workers, error } = await supabase
    .from("workers")
    .select("id, full_name, phone, specialties, pay_rate_type, pay_rate, is_active")
    .order("full_name");

  const canManage = user.role === "owner" || user.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Workers</h1>
          <p className="text-sm text-slate-500">Tailors and artisans you assign cutting, stitching, embroidery and hand-work tasks to.</p>
        </div>
        {canManage && <NewWorkerDialog />}
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {!canManage && (
        <p className="text-sm text-slate-400">Only shop owners/admins can add or edit workers — ask yours to add one.</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Specialties</th>
              <th className="px-4 py-3">Pay rate</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workers?.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{w.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{w.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {w.specialties?.length ? w.specialties.map((s: string) => s.replace("_", " ")).join(", ") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {w.pay_rate.toFixed(2)} ({w.pay_rate_type.replace("_", " ")})
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <WorkerActiveToggle workerId={w.id} isActive={w.is_active} />
                  ) : (
                    <span className="text-xs text-slate-500">{w.is_active ? "Active" : "Inactive"}</span>
                  )}
                </td>
              </tr>
            ))}
            {workers?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No workers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
