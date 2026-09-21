import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "atelierhq-ui";

export function CustomerListAndOrderDetail() {
  return (
    <ResizablePanelGroup orientation="horizontal" className="rounded-lg border border-border bg-card" style={{ height: 220 }}>
      <ResizablePanel defaultSize="35%" minSize="20%">
        <div className="flex flex-col gap-2 p-4 text-sm">
          <span className="font-medium text-foreground">Customers</span>
          <span className="text-muted-foreground">Chinedu Okafor</span>
          <span className="text-muted-foreground">Adaeze Nwosu</span>
          <span className="text-muted-foreground">Mrs. Bello</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="65%">
        <div className="flex flex-col gap-2 p-4 text-sm">
          <span className="font-medium text-foreground">ORD-0042 · Agbada set</span>
          <span className="text-muted-foreground">Chest 38 in · Waist 32 in · Sleeve 24 in</span>
          <span className="text-foreground">₦185,000 · In progress</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function VerticalSplit() {
  return (
    <ResizablePanelGroup orientation="vertical" className="rounded-lg border border-border bg-card" style={{ height: 260 }}>
      <ResizablePanel defaultSize="40%">
        <div className="flex flex-col gap-1 p-4 text-sm">
          <span className="font-medium text-foreground">Order summary</span>
          <span className="text-muted-foreground">ORD-0041 · Ankara gown · Adaeze Nwosu</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="60%">
        <div className="flex flex-col gap-1 p-4 text-sm">
          <span className="font-medium text-foreground">Tailor notes</span>
          <span className="text-muted-foreground">Fitting on Friday; adjust waist to 32 in.</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
