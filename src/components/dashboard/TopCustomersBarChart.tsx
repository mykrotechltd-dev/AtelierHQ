"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currencyNGN } from "@/lib/reports/analytics";

// Single series (magnitude) — one hue, matching the revenue chart's
// "Collected" navy so the two money-shaped charts read as one system.
const BAR_COLOR = "#184f95";

export type CustomerPoint = { name: string; total: number };

export function TopCustomersBarChart({ data }: { data: CustomerPoint[] }) {
  if (data.length === 0) {
    return <p className="flex h-[200px] items-center justify-center text-sm text-slate-400">No orders yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#e1e0d9" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "#898781", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
        />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#52514e", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value: number) => currencyNGN(value)} contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 13 }} />
        <Bar dataKey="total" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
