import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea } from "atelierhq-ui";
import { Search, Phone } from "lucide-react";

export function WithIcon() {
  return (
    <div className="flex flex-col gap-3 w-80">
      <InputGroup>
        <InputGroupAddon><Search /></InputGroupAddon>
        <InputGroupInput placeholder="Search orders or customers" />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon><Phone /></InputGroupAddon>
        <InputGroupInput defaultValue="0803 555 0142" />
      </InputGroup>
    </div>
  );
}

export function TextAddons() {
  return (
    <div className="flex flex-col gap-3 w-80">
      <InputGroup>
        <InputGroupAddon><InputGroupText>₦</InputGroupText></InputGroupAddon>
        <InputGroupInput defaultValue="185,000" />
        <InputGroupAddon align="inline-end"><InputGroupText>NGN</InputGroupText></InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput defaultValue="38" />
        <InputGroupAddon align="inline-end"><InputGroupText>inches</InputGroupText></InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export function WithButton() {
  return (
    <div className="flex flex-col gap-3 w-80">
      <InputGroup>
        <InputGroupInput placeholder="Enter order number" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary">Find</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex flex-col gap-3 w-80">
      <InputGroup>
        <InputGroupAddon><InputGroupText>₦</InputGroupText></InputGroupAddon>
        <InputGroupInput aria-invalid defaultValue="-500" />
      </InputGroup>
    </div>
  );
}

export function WithTextarea() {
  return (
    <div className="w-80">
      <InputGroup>
        <InputGroupTextarea rows={3} defaultValue="Slim fit through the waist, extra length on sleeves." />
        <InputGroupAddon align="block-end"><InputGroupText>52 / 200</InputGroupText></InputGroupAddon>
      </InputGroup>
    </div>
  );
}
