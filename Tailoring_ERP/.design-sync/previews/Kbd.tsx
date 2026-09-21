import { Kbd, KbdGroup } from "atelierhq-ui";

export function Shortcuts() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="w-32 text-muted-foreground">Search orders</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-32 text-muted-foreground">New order</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>N</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-32 text-muted-foreground">Close</span>
        <Kbd>Esc</Kbd>
      </div>
    </div>
  );
}

export function Inline() {
  return (
    <p className="max-w-sm text-sm text-muted-foreground">
      Press <Kbd>Enter</Kbd> to save the measurements or <Kbd>Esc</Kbd> to cancel.
    </p>
  );
}
