import { Switch, Label } from "atelierhq-ui";

export function States() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><Switch id="s1" /><Label htmlFor="s1">Email invoice to customer</Label></div>
      <div className="flex items-center gap-2"><Switch id="s2" defaultChecked /><Label htmlFor="s2">Send fitting reminder by SMS</Label></div>
      <div className="flex items-center gap-2"><Switch id="s3" disabled /><Label htmlFor="s3">Auto-assign tailor</Label></div>
      <div className="flex items-center gap-2"><Switch id="s4" disabled defaultChecked /><Label htmlFor="s4">Track order status</Label></div>
    </div>
  );
}

export function Settings() {
  return (
    <div className="flex flex-col gap-4 w-80">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="n1">Notify when order is completed</Label>
        <Switch id="n1" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="n2">Weekly sales summary</Label>
        <Switch id="n2" />
      </div>
    </div>
  );
}
