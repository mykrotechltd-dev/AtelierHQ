import { Toggle } from "atelierhq-ui";
import { Bold, Italic, Underline } from "lucide-react";

export function Variants() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Toggle aria-label="Bold"><Bold /></Toggle>
      <Toggle aria-label="Italic" defaultPressed><Italic /></Toggle>
      <Toggle variant="outline" aria-label="Underline"><Underline /></Toggle>
      <Toggle variant="outline" defaultPressed aria-label="Bold"><Bold /></Toggle>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Toggle size="sm" variant="outline" defaultPressed>Rush</Toggle>
      <Toggle variant="outline" defaultPressed>Rush</Toggle>
      <Toggle size="lg" variant="outline">Rush</Toggle>
    </div>
  );
}
