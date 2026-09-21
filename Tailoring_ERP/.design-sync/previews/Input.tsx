import { Input, Label } from "atelierhq-ui";

export function Default() {
  return (
    <div className="flex flex-col gap-3 w-80">
      <Input placeholder="Customer full name" />
      <Input defaultValue="Chinedu Okafor" />
      <Input type="email" placeholder="chinedu@example.com" />
    </div>
  );
}

export function WithLabel() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="phone">Phone number</Label>
      <Input id="phone" type="tel" defaultValue="0803 555 0142" />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="ord">Order number</Label>
      <Input id="ord" disabled defaultValue="ORD-0042" />
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="chest">Chest (inches)</Label>
      <Input id="chest" aria-invalid defaultValue="380" />
      <p className="text-sm text-destructive">Chest must be between 20 and 70 inches.</p>
    </div>
  );
}
