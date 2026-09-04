"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PIPELINE_STATUSES, STATUS_COLORS, STATUS_LABELS } from "@/lib/reports/analytics";

export function StatusDonut({ counts }: { counts: Record<string, number> }) {
  const segments = PIPELINE_STATUSES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    value: counts[s] ?? 0,
    color: STATUS_COLORS[s],
  }));

  if (segments.length === 0) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
        <div className="h-24 w-24 rounded-full border-[14px] border-slate-100" aria-hidden />
        No orders yet
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={segments} dataKey="value" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={segments.length > 1 ? 2 : 0}>
            {segments.map((s) => (
              <Cell key={s.status} fill={s.color} stroke="#F7F3EA" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, _name, item) => [value, item.payload.label]} contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 13 }} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.status} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
