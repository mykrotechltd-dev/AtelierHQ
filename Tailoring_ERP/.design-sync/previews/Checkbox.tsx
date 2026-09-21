import { Checkbox, Label } from "atelierhq-ui";

export function States() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><Checkbox id="c1" /><Label htmlFor="c1">Rush order</Label></div>
      <div className="flex items-center gap-2"><Checkbox id="c2" defaultChecked /><Label htmlFor="c2">Deposit received</Label></div>
      <div className="flex items-center gap-2"><Checkbox id="c3" disabled /><Label htmlFor="c3">Delivered to customer</Label></div>
      <div className="flex items-center gap-2"><Checkbox id="c4" disabled defaultChecked /><Label htmlFor="c4">Measurements confirmed</Label></div>
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" aria-invalid />
      <Label htmlFor="terms">Customer agreed to fitting policy</Label>
    </div>
  );
}

export function Checklist() {
  return (
    <div className="flex flex-col gap-3 w-80">
      <p className="text-sm text-muted-foreground">Finishing checklist for ORD-0042</p>
      <div className="flex items-center gap-2"><Checkbox id="k1" defaultChecked /><Label htmlFor="k1">Buttons and hooks attached</Label></div>
      <div className="flex items-center gap-2"><Checkbox id="k2" defaultChecked /><Label htmlFor="k2">Hem pressed</Label></div>
      <div className="flex items-center gap-2"><Checkbox id="k3" /><Label htmlFor="k3">Final fitting done</Label></div>
    </div>
  );
}
