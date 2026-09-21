import { Label, Input, Checkbox } from "atelierhq-ui";

export function WithInput() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="cust">Customer name</Label>
      <Input id="cust" defaultValue="Adaeze Nwosu" />
    </div>
  );
}

export function WithCheckbox() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="deposit" defaultChecked />
      <Label htmlFor="deposit">Deposit received (50%)</Label>
    </div>
  );
}

export function DisabledField() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="due">Due date</Label>
      <Input id="due" disabled defaultValue="Locked after delivery" />
    </div>
  );
}
