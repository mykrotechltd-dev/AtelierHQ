import { Button } from "atelierhq-ui";
import { Plus, Scissors, Trash2 } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>New order</Button>
      <Button variant="secondary">Save draft</Button>
      <Button variant="outline">Export invoice</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Delete order</Button>
      <Button variant="link">View measurements</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

export function WithIcons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Plus /> Add customer
      </Button>
      <Button variant="outline">
        <Scissors /> Schedule fitting
      </Button>
      <Button variant="destructive">
        <Trash2 /> Remove worker
      </Button>
      <Button variant="outline" size="icon" aria-label="Schedule fitting">
        <Scissors />
      </Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Record payment</Button>
      <Button variant="secondary" disabled>
        Save draft
      </Button>
      <Button variant="outline" disabled>
        Export invoice
      </Button>
    </div>
  );
}
