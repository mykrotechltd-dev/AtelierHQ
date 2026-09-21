import { Textarea, Label } from "atelierhq-ui";

export function Default() {
  return (
    <div className="w-80">
      <Textarea placeholder="Notes on the garment, fit or fabric" />
    </div>
  );
}

export function WithLabelAndValue() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="notes">Garment notes</Label>
      <Textarea id="notes" defaultValue="Agbada set in royal blue guinea brocade. Add extra 2 inches to the sleeve length and embroider initials on the cuff." />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="w-80">
      <Textarea disabled defaultValue="Order delivered on ORD-0042. Notes are locked." />
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="alt">Alteration request</Label>
      <Textarea id="alt" aria-invalid defaultValue="" placeholder="Describe the alteration" />
      <p className="text-sm text-destructive">Please describe the alteration.</p>
    </div>
  );
}
