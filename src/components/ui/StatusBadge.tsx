const STYLES: Record<string, string> = {
  received: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-indigo-100 text-indigo-800",
  done: "bg-emerald-100 text-emerald-800",
  blocked: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status.replace("_", " ")}
    </span>
  );
}
