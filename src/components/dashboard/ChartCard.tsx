import type { LucideIcon } from "lucide-react";

export function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-slate-400" aria-hidden />}
        <h3 className="font-serif text-base font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}
