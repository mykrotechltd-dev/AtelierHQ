import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "atelierhq-ui";
import { ChevronsUpDown } from "lucide-react";

export function Measurements() {
  return (
    <Collapsible defaultOpen className="w-72 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Measurements (in)</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <div className="rounded-md border px-3 py-2 text-sm">Chest 38</div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-3 py-2 text-sm">Waist 32</div>
        <div className="rounded-md border px-3 py-2 text-sm">Shoulder 17</div>
        <div className="rounded-md border px-3 py-2 text-sm">Sleeve 24</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Closed() {
  return (
    <Collapsible className="w-72 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Fitting notes</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="rounded-md border px-3 py-2 text-sm">
        Take in the waist by half an inch.
      </CollapsibleContent>
    </Collapsible>
  );
}
