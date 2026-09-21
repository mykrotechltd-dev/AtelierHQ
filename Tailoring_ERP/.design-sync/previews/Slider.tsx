import { Slider, Label } from "atelierhq-ui";

export function Single() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 260 }}>
      <Label>Deposit percentage</Label>
      <Slider defaultValue={[50]} max={100} step={5} />
    </div>
  );
}

export function Range() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 260 }}>
      <Label>Budget range (₦ thousands)</Label>
      <Slider defaultValue={[80, 220]} max={400} step={10} />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 260 }}>
      <Label>Chest adjustment (inches)</Label>
      <Slider defaultValue={[38]} min={30} max={50} disabled />
    </div>
  );
}
