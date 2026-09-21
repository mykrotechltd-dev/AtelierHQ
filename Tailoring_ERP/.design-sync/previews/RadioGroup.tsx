import { RadioGroup, RadioGroupItem, Label } from "atelierhq-ui";

export function PaymentMethod() {
  return (
    <RadioGroup defaultValue="transfer">
      <div className="flex items-center gap-2"><RadioGroupItem value="cash" id="r-cash" /><Label htmlFor="r-cash">Cash</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="transfer" id="r-transfer" /><Label htmlFor="r-transfer">Bank transfer</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="card" id="r-card" /><Label htmlFor="r-card">Card</Label></div>
    </RadioGroup>
  );
}

export function WithDisabledOption() {
  return (
    <RadioGroup defaultValue="pickup">
      <div className="flex items-center gap-2"><RadioGroupItem value="pickup" id="d-pickup" /><Label htmlFor="d-pickup">Pick up at shop</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="courier" id="d-courier" /><Label htmlFor="d-courier">Courier delivery</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="intl" id="d-intl" disabled /><Label htmlFor="d-intl">International shipping</Label></div>
    </RadioGroup>
  );
}

export function Invalid() {
  return (
    <RadioGroup>
      <div className="flex items-center gap-2"><RadioGroupItem value="a" id="i-a" aria-invalid /><Label htmlFor="i-a">Slim fit</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="b" id="i-b" aria-invalid /><Label htmlFor="i-b">Regular fit</Label></div>
    </RadioGroup>
  );
}
