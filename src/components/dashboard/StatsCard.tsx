import type { LucideIcon } from "lucide-react";

export function StatsCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** "warning" is for a figure that needs attention (e.g. an outstanding balance) — amber border/text instead of the default navy. */
  tone?: "default" | "warning";
}) {
  const isWarning = tone === "warning";
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        isWarning ? "border-accent-400" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-400" aria-hidden />}
      </div>
      <p className={`mt-3 font-serif text-2xl font-semibold ${isWarning ? "text-accent-600" : "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
