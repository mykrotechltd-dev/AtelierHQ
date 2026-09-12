import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/**
 * Catch-all for unmatched routes *inside* AdminLayout — mirrors
 * src/pages/app/not-found.tsx so a stale link inside the admin console
 * keeps the admin sidebar instead of falling through to the bare global
 * NotFound page.
 */
export default function AdminNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Compass className="size-10 text-muted-foreground" />
      <div>
        <h1 className="font-sans text-xl font-semibold text-foreground">
          That page isn&apos;t here
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The link may be out of date, or point to something that&apos;s been
          removed.
        </p>
      </div>
      <Button asChild>
        <Link to="/admin/dashboard">Back to admin dashboard</Link>
      </Button>
    </div>
  );
}
