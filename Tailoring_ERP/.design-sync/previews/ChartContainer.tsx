import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from "atelierhq-ui";

const data = [
  { month: "May", billed: 1200000, collected: 980000 },
  { month: "Jun", billed: 1450000, collected: 1210000 },
  { month: "Jul", billed: 1320000, collected: 1290000 },
  { month: "Aug", billed: 1780000, collected: 1500000 },
  { month: "Sep", billed: 1960000, collected: 1720000 },
];

const config = {
  billed: { label: "Billed", color: "var(--chart-1)" },
  collected: { label: "Collected", color: "var(--chart-2)" },
};

const fmt = (v: number) => `₦${(v / 1000000).toFixed(1)}m`;

export function BilledVsCollected() {
  return (
    <ChartContainer config={config} style={{ height: 260, width: "100%" }}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar isAnimationActive={false} dataKey="billed" fill="var(--color-billed)" radius={4} />
        <Bar isAnimationActive={false} dataKey="collected" fill="var(--color-collected)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function CollectionsTrend() {
  return (
    <ChartContainer config={config} style={{ height: 260, width: "100%" }}>
      <AreaChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area isAnimationActive={false} dataKey="collected" type="monotone" stroke="var(--color-collected)" fill="var(--color-collected)" fillOpacity={0.25} />
      </AreaChart>
    </ChartContainer>
  );
}
