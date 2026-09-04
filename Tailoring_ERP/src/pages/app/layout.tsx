import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { Authenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import AppSidebar from "./_components/app-sidebar.tsx";
import MobileNav from "./_components/mobile-nav.tsx";

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const tenant = useQuery(api.tenants.getMyTenant, {});

  useEffect(() => {
    if (tenant === undefined) return;
    if (tenant === null) {
      navigate("/onboarding", { replace: true });
    }
  }, [tenant, navigate]);

  if (tenant === undefined) {
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
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AppShell />
      </Authenticated>
    </>
  );
}
