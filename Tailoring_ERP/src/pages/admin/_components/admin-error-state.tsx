import { AlertTriangle } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Button } from "@/components/ui/button.tsx";

/** Shown wherever an admin RPC call fails, instead of leaving the page on
 *  an indefinite loading skeleton (data === undefined can't distinguish
 *  "still loading" from "the request failed") or silently rendering an
 *  empty state that looks like there's simply nothing there. */
export function AdminErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          {message ?? "This couldn't be loaded. Please try again."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  );
}
