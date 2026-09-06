import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@/components/providers/auth.tsx";
import { useMyTenant } from "@/lib/queries/tenants.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import AppSidebar from "./_components/app-sidebar.tsx";
import MobileNav from "./_components/mobile-nav.tsx";

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
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>
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
