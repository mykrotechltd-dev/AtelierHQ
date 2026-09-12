import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import type { Tenant } from "@/lib/supabase/types.ts";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserCheck,
  CheckSquare,
  CreditCard,
  BarChart3,
  Settings,
  ScissorsLineDashed,
  LogOut,
  Scissors,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { ThemeToggle } from "@/components/theme-toggle.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Orders", icon: ClipboardList, path: "/orders" },
  { label: "Workers", icon: UserCheck, path: "/workers" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Patterns", icon: Scissors, path: "/patterns" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
];

export default function AppSidebar({
  tenant,
  currentPath,
}: {
  tenant: Tenant | null;
  currentPath: string;
}) {
  const { signout } = useAuth();

  return (
    <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <ScissorsLineDashed className="size-5 text-sidebar-primary shrink-0" />
        <div className="min-w-0">
          <p className="font-sans text-base font-semibold leading-none truncate text-sidebar-foreground">
            {tenant?.name ?? "AtelierHQ"}
          </p>
          <p className="text-[11px] text-sidebar-foreground/50 mt-0.5 font-body tracking-wide uppercase">
            {tenant?.currency ?? ""}
          </p>
        </div>
      </div>

      {/* Nav */}
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

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <NavLink
          to="/billing"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-body transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            )
          }
        >
          <Wallet className="size-4 shrink-0" />
          Billing
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-body transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            )
          }
        >
          <Settings className="size-4 shrink-0" />
          Settings
        </NavLink>
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 px-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent font-body"
              onClick={() => signout()}
            >
              <LogOut className="size-4 shrink-0" />
              Sign out
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
