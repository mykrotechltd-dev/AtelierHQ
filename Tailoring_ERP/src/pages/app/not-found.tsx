import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/**
 * Catch-all for unmatched routes *inside* AppLayout — rendered via
 * <Outlet/>, so the sidebar and nav stay put. A stale link to a deleted
 * order or a typo in the URL bar shouldn't drop someone out of the app
 * shell into the bare global NotFound page.
 */
export default function AppNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Compass className="size-10 text-muted-foreground" />
      <div>
        <h1 className="font-sans text-xl font-semibold text-foreground">
          That page isn&apos;t here
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The link may be out of date, or the order or customer it pointed to
          may have been removed.
        </p>
      </div>
      <Button asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
