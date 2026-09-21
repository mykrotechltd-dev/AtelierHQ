import { Separator } from "atelierhq-ui";

export function Horizontal() {
  return (
    <div className="w-72">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-medium text-foreground">ORD-0042 · Agbada set</h4>
        <p className="text-sm text-muted-foreground">Chinedu Okafor</p>
      </div>
      <Separator className="my-4" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-medium text-foreground">₦185,000</span>
      </div>
    </div>
  );
}

export function Vertical() {
  return (
    <div className="flex h-5 items-center gap-4 text-sm text-foreground">
      <span>Orders</span>
      <Separator orientation="vertical" />
      <span>Customers</span>
      <Separator orientation="vertical" />
      <span>Measurements</span>
    </div>
  );
}
