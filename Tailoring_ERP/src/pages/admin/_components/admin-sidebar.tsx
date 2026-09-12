import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  CalendarDays,
  Boxes,
  UserCheck,
  Store,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { ThemeToggle } from "@/components/theme-toggle.tsx";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Orders", icon: ClipboardList, path: "/admin/orders" },
  { label: "Clients", icon: Users, path: "/admin/clients" },
  { label: "Schedule", icon: CalendarDays, path: "/admin/schedule" },
  { label: "Inventory", icon: Boxes, path: "/admin/inventory" },
  { label: "Staff", icon: UserCheck, path: "/admin/staff" },
  { label: "Shops", icon: Store, path: "/admin/shops" },
];

export default function AdminSidebar({
  currentPath,
}: {
  currentPath: string;
}) {
  const { signout } = useAdminAuth();

  return (
    <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <ShieldCheck className="size-5 text-sidebar-primary shrink-0" />
        <div className="min-w-0">
          <p className="font-sans text-base font-semibold leading-none truncate text-sidebar-foreground">
            AtelierHQ Admin
          </p>
          <p className="text-[11px] text-sidebar-foreground/50 mt-0.5 font-body tracking-wide uppercase">
            Platform
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-body transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 px-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent font-body"
          onClick={() => signout()}
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
