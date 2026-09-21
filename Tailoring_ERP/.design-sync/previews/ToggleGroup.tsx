import { ToggleGroup, ToggleGroupItem } from "atelierhq-ui";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic } from "lucide-react";

export function OrderStatus() {
  return (
    <div className="p-4">
      <ToggleGroup type="single" variant="outline" defaultValue="all">
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="progress">In progress</ToggleGroupItem>
        <ToggleGroupItem value="completed">Completed</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function Alignment() {
  return (
    <div className="p-4">
      <ToggleGroup type="single" defaultValue="left">
        <ToggleGroupItem value="left" aria-label="Align left"><AlignLeft /></ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center"><AlignCenter /></ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right"><AlignRight /></ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function MultipleStyles() {
  return (
    <div className="p-4">
      <ToggleGroup type="multiple" variant="outline" size="sm" defaultValue={["bold"]}>
        <ToggleGroupItem value="bold" aria-label="Bold"><Bold /></ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic"><Italic /></ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
