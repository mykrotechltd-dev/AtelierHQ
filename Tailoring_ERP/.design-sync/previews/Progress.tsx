import { Progress } from "atelierhq-ui";

export function PaymentProgress() {
  const rows = [
    ["ORD-0038 · Not paid", 0],
    ["ORD-0042 · Deposit paid", 35],
    ["ORD-0045 · Part paid", 70],
    ["ORD-0031 · Fully paid", 100],
  ] as const;
  return (
    <div className="flex w-80 flex-col gap-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground">{value}%</span>
          </div>
          <Progress value={value} />
        </div>
      ))}
    </div>
  );
}

export function Single() {
  return (
    <div className="w-64">
      <Progress value={70} />
    </div>
  );
}
