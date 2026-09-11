import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AdminAuthProvider,
  useAdminSession,
} from "@/components/providers/admin-auth.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import AdminSidebar from "./_components/admin-sidebar.tsx";
import AdminMobileNav from "./_components/admin-mobile-nav.tsx";
import AdminHeader from "./_components/admin-header.tsx";

function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useAdminSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/admin/login", { replace: true });
    }
  }, [status, navigate]);

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
