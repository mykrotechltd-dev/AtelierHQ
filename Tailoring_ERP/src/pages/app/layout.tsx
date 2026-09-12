import { useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@/components/providers/auth.tsx";
import { useMyTenant } from "@/lib/queries/tenants.ts";
import { useBillingState } from "@/lib/queries/billing.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AlertTriangle } from "lucide-react";
import AppSidebar from "./_components/app-sidebar.tsx";
import MobileNav from "./_components/mobile-nav.tsx";

// Enforcement itself lives in Postgres (tenant_can_write() + the RLS/RPC
// guards in supabase/migrations/0006_subscription_billing.sql) — this
// banner is UX only. Hidden on /billing itself, which already shows the
// same state in more detail.
function TrialBanner() {
  const location = useLocation();
  const billing = useBillingState();

  if (!billing || location.pathname === "/billing") return null;
  if (billing.state === "active") return null;

  if (billing.state === "readonly") {
    return (
      <div className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        Your trial has ended. Your data is safe, but you need to{" "}
        <Link to="/billing" className="font-medium underline underline-offset-2">
          subscribe
        </Link>{" "}
        to make changes.
      </div>
    );
  }

  if (billing.daysLeft <= 7) {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
        {billing.daysLeft} day{billing.daysLeft === 1 ? "" : "s"} left in your
        free trial —{" "}
        <Link to="/billing" className="font-medium underline underline-offset-2">
          subscribe
        </Link>{" "}
        to keep going.
      </div>
    );
  }

  return null;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const tenant = useMyTenant();

  useEffect(() => {
    if (tenant === undefined) return;
    if (tenant === null) {
      navigate("/onboarding", { replace: true });
    }
  }, [tenant, navigate]);

  if (tenant === undefined || tenant === null) {
    return (
      <div className="flex h-screen">
        <div className="hidden md:flex w-60 flex-col gap-4 p-4 border-r bg-sidebar">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full opacity-30" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar tenant={tenant} currentPath={location.pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TrialBanner />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      <MobileNav currentPath={location.pathname} />
    </div>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/login", { replace: true });
    }
  }, [status, navigate]);

  if (status !== "authenticated") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return <AppShell />;
}
