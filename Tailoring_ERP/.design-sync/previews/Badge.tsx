import { Badge } from "atelierhq-ui";
import { Clock } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Overdue</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  );
}

export function OrderStatus() {
  const items = [
    ["Received", "bg-blue-100 text-blue-700", "bg-blue-500"],
    ["In Progress", "bg-amber-100 text-amber-700", "bg-amber-500"],
    ["Completed", "bg-emerald-100 text-emerald-700", "bg-emerald-500"],
    ["Delivered", "bg-muted text-muted-foreground", "bg-muted-foreground"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(([label, color, dot]) => (
        <Badge key={label} className={`gap-1.5 px-2.5 ${color}`}>
          <span className={`size-1.5 rounded-full ${dot}`} />
          {label}
        </Badge>
      ))}
    </div>
  );
}

export function WithIcon() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">
        <Clock /> Due in 3 days
      </Badge>
      <Badge variant="outline">ORD-0042</Badge>
      <Badge variant="destructive">Balance ₦85,000</Badge>
    </div>
  );
}
