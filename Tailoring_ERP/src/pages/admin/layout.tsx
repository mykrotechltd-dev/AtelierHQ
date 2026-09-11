import { useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import {
  AdminAuthProvider,
  useAdminSession,
} from "@/components/providers/admin-auth.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import AdminSidebar from "./_components/admin-sidebar.tsx";
import AdminMobileNav from "./_components/admin-mobile-nav.tsx";
import AdminHeader from "./_components/admin-header.tsx";

/** Shown when a real, logged-in session isn't a platform admin. Distinct
 *  from "unauthenticated" on purpose: this person is genuinely signed in
 *  (quite possibly as a tenant owner or worker) — they don't need a login
 *  form, they need to know why they can't see this and a way back to the
 *  app they actually have access to. */
function AccessDenied() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <ShieldAlert className="size-10 text-destructive" />
      <div>
        <h1 className="font-sans text-xl font-semibold text-foreground">
          Access denied
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your account is signed in, but it doesn't have platform admin access.
          This area is for AtelierHQ staff only.
        </p>
      </div>
      <Button asChild>
        <Link to="/dashboard">Go to your dashboard</Link>
      </Button>
    </div>
  );
}

function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useAdminSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/admin/login", { replace: true });
    }
  }, [status, navigate]);

  if (status === "forbidden") {
    return <AccessDenied />;
  }

  if (status !== "authenticated") {
    return (
      <div className="flex h-screen">
        <div className="hidden md:flex w-60 flex-col gap-4 p-4 border-r bg-sidebar">
          {Array.from({ length: 6 }).map((_, i) => (
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
      <AdminSidebar currentPath={location.pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      <AdminMobileNav currentPath={location.pathname} />
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminShell />
    </AdminAuthProvider>
  );
}
