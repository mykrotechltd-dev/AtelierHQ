"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currencyNGN } from "@/lib/reports/analytics";

// Collected/Billed are one hue at two lightness steps (from the dataviz
// skill's validated sequential blue ramp), not two categorical identities —
// Billed is Collected's own total/context, always >= it. The categorical
// CVD/lightness checks don't apply to a same-hue pair like this (see
// palette.md's own scope note); the light "Billed" bar gets a visible
// stroke instead so it still reads as a distinct shape against the cream
// page even where its fill has low contrast against that same surface.
const COLLECTED_COLOR = "#184f95";
const BILLED_FILL = "#b7d3f6";
const BILLED_STROKE = "#6da7ec";

export type RevenuePoint = { label: string; collected: number; billed: number };

export function RevenueBarChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={4} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#898781", fontSize: 12 }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
        <YAxis
          tick={{ fill: "#898781", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
        />
        <Tooltip
          formatter={(value: number) => currencyNGN(value)}
          contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 13 }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
        />
        <Bar dataKey="billed" name="Billed" fill={BILLED_FILL} stroke={BILLED_STROKE} radius={[4, 4, 0, 0]} />
        <Bar dataKey="collected" name="Collected" fill={COLLECTED_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
