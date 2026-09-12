import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/**
 * Global catch-all — only reachable for URLs genuinely outside the app,
 * since AppLayout and AdminLayout each have their own nested "*" route
 * (see src/pages/app/not-found.tsx, src/pages/admin/not-found.tsx) that
 * keeps their sidebar instead of falling through to this bare page.
 */
export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Compass className="size-10 text-muted-foreground" />
      <div>
        <h1 className="font-sans text-xl font-semibold text-foreground">
          That page isn&apos;t here
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The link may be out of date. Head back and pick up where you left
          off.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Back to AtelierHQ</Link>
      </Button>
    </div>
  );
}
