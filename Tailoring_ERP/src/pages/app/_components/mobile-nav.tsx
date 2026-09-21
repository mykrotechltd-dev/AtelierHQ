import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CheckSquare,
  CreditCard,
  Scissors,
  MoreHorizontal,
  UserCheck,
  BarChart3,
  Wallet,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";

const PRIMARY = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Orders", icon: ClipboardList, path: "/orders" },
  { label: "Patterns", icon: Scissors, path: "/patterns" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
];

const MORE = [
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Workers", icon: UserCheck, path: "/workers" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Billing", icon: Wallet, path: "/billing" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const isActive = (current: string, path: string) =>
  current === path || current.startsWith(path + "/");

export default function MobileNav({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const moreActive = MORE.some((m) => isActive(currentPath, m.path));

  return (
    <>
      <nav
        aria-label="Primary"
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-background/95 px-2 backdrop-blur md:hidden"
      >
        {PRIMARY.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition-colors",
              isActive(currentPath, path)
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition-colors",
            moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2.5 px-4">
            {MORE.map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(path);
                }}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 text-sm font-semibold"
              >
                <Icon className="size-5 text-muted-foreground" />
                {label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
