import { PIPELINE_STATUSES, STATUS_COLORS, STATUS_LABELS } from "@/lib/reports/analytics";

export function StatusPills({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {PIPELINE_STATUSES.map((status) => (
        <div key={status} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} aria-hidden />
          <div>
            <p className="font-serif text-xl font-semibold text-slate-900">{counts[status] ?? 0}</p>
            <p className="text-xs text-slate-500">{STATUS_LABELS[status]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
