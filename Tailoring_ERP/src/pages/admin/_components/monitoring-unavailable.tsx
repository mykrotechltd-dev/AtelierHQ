import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";

/** Shown when a monitoring read fails. The most likely cause on a fresh
 *  deploy is that migration 0008 has not been run yet, so say so plainly. */
export default function MonitoringUnavailable({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <Card
      role="alert"
      className="flex-row flex-wrap items-center gap-4 border-warning/40 p-5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
        <AlertTriangle className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <b className="font-semibold">This view could not load</b>
        <p className="text-[13px] text-muted-foreground">
          If you have not yet run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            0008_activity_and_audit.sql
          </code>{" "}
          in the Supabase SQL Editor, that is the likely cause. Otherwise try
          again.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}
