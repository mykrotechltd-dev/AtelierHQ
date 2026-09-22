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
  Activity,
  ScrollText,
  TrendingUp,
  Sparkles,
  Send,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth.ts";
import { ThemeToggle } from "@/components/theme-toggle.tsx";

const GROUPS = [
  {
    label: "Platform workspace",
    items: [
      { label: "Overview", icon: LayoutDashboard, path: "/admin/dashboard" },
      { label: "Shops", icon: Store, path: "/admin/shops" },
      { label: "Activity", icon: Activity, path: "/admin/activity" },
    ],
  },
  {
    label: "Control",
    items: [
      { label: "Audit log", icon: ScrollText, path: "/admin/audit" },
      { label: "Revenue", icon: TrendingUp, path: "/admin/revenue" },
      {
        label: "Notifications",
        icon: Send,
        path: "/admin/notifications",
      },
    ],
  },
  {
    label: "Shop data",
    items: [
      { label: "Orders", icon: ClipboardList, path: "/admin/orders" },
      { label: "Clients", icon: Users, path: "/admin/clients" },
      { label: "Schedule", icon: CalendarDays, path: "/admin/schedule" },
      { label: "Inventory", icon: Boxes, path: "/admin/inventory" },
      { label: "Staff", icon: UserCheck, path: "/admin/staff" },
    ],
  },
] as const;

export default function AdminSidebar({
  // Kept so the layout can pass the current path; NavLink derives active
  // state itself.
  currentPath: _currentPath,
}: {
  currentPath: string;
}) {
  const { signout } = useAdminAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-sans text-base font-semibold leading-tight text-sidebar-accent-foreground">
            AtelierHQ
            <span className="ml-1.5 align-[2px] font-mono text-[9.5px] font-medium tracking-[0.14em] text-sidebar-primary">
              ADMIN
            </span>
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            Platform workspace
          </p>
        </div>
      </div>

      <nav
        aria-label="Admin"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-3"
      >
        {GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/50">
              {group.label}
            </p>
            {group.items.map(({ label, icon: Icon, path }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)]"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )
                }
              >
                <Icon className="size-[18px] shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 px-3 pb-4">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signout()}
          className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-[18px] shrink-0" />
          Sign out
        </button>
        <p className="mt-3 px-3 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-sidebar-foreground/40">
          All sensitive actions are audited
        </p>
      </div>
    </aside>
  );
}
