import { Link, NavLink } from "react-router-dom";
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
  LogOut,
  Scissors,
  Wallet,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";
import { useBillingState } from "@/lib/queries/billing.ts";
import { ThemeToggle } from "@/components/theme-toggle.tsx";
import Meter from "@/components/meter.tsx";

const NAV_GROUPS = [
  {
    label: "Workshop",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Customers", icon: Users, path: "/customers" },
      { label: "Orders", icon: ClipboardList, path: "/orders" },
      { label: "Workers", icon: UserCheck, path: "/workers" },
      { label: "Tasks", icon: CheckSquare, path: "/tasks" },
    ],
  },
  {
    label: "Studio",
    items: [
      { label: "Patterns", icon: Scissors, path: "/patterns" },
      { label: "Reports", icon: BarChart3, path: "/reports" },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Payments", icon: CreditCard, path: "/payments" },
      { label: "Billing", icon: Wallet, path: "/billing" },
      { label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
] as const;

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-body transition-colors",
    isActive
      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)]"
      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
  );

export default function AppSidebar({ tenant }: { tenant: Tenant | null }) {
  const { signout } = useAuth();
  const billing = useBillingState();
  const showTrial = billing?.state === "trialing";
  const trialDays = billing?.daysLeft ?? 0;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-sans text-base font-semibold leading-tight text-sidebar-accent-foreground">
            AtelierHQ
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {tenant?.name ?? ""}
          </p>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-3"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
              {group.label}
            </p>
            {group.items.map(({ label, icon: Icon, path }) => (
              <NavLink key={path} to={path} className={itemClass}>
                <Icon className="size-[18px] shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-3 px-3 pb-4">
        {showTrial && (
          <div className="rounded-xl bg-sidebar-accent/70 p-3.5 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <span>Trial atelier</span>
              <b className="tabular-nums">
                {trialDays} day{trialDays === 1 ? "" : "s"} left
              </b>
            </div>
            <Meter
              value={30 - trialDays}
              max={30}
              className="mt-2.5 bg-sidebar-foreground/15"
              label={`${trialDays} of 30 trial days left`}
            />
            <Link
              to="/billing"
              className="mt-2.5 inline-block font-semibold underline underline-offset-4"
            >
              Review plan
            </Link>
          </div>
        )}
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signout()}
          className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-[18px] shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
