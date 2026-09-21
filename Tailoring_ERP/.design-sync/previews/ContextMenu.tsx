import { useEffect, useRef } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "atelierhq-ui";

// Opens via a real contextmenu event dispatched on mount (right-click substitute).
export function Default() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 160, clientY: 120 }),
      );
    }, 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={ref}
          className="flex items-center justify-center border-border text-sm text-muted-foreground"
          style={{ height: 300, margin: 16, border: "1px dashed", borderRadius: 8 }}
        >
          Right-click an order row
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem>
          View order <ContextMenuShortcut>⏎</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Record payment <ContextMenuShortcut>⌘P</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>Mark as completed</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Delete order</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
