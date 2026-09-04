import { currencyNGN } from "@/lib/reports/analytics";

export type WorkerPerformanceRow = {
  workerId: string;
  fullName: string;
  specialization: string;
  tasksDone: number;
  tasksInProgress: number;
  tasksPending: number;
  totalPaidOut: number;
};

export function WorkerPerformanceTable({ rows }: { rows: WorkerPerformanceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Worker</th>
            <th className="px-4 py-2.5">Specialization</th>
            <th className="px-4 py-2.5 text-right">Tasks done</th>
            <th className="px-4 py-2.5 text-right">In progress</th>
            <th className="px-4 py-2.5 text-right">Pending</th>
            <th className="px-4 py-2.5 text-right">Payouts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((w) => (
            <tr key={w.workerId}>
              <td className="px-4 py-2.5 font-medium text-slate-800">{w.fullName}</td>
              <td className="px-4 py-2.5 text-slate-600">{w.specialization}</td>
              <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{w.tasksDone}</td>
              <td className="px-4 py-2.5 text-right font-medium text-accent-500">{w.tasksInProgress}</td>
              <td className="px-4 py-2.5 text-right text-slate-500">{w.tasksPending}</td>
              <td className="px-4 py-2.5 text-right text-slate-700">{currencyNGN(w.totalPaidOut)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                No workers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
