import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CheckSquare,
  CreditCard,
  Scissors,
} from "lucide-react";

const MOBILE_NAV = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Orders", icon: ClipboardList, path: "/orders" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Patterns", icon: Scissors, path: "/patterns" },
];

export default function MobileNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-border bg-background md:hidden z-40 safe-area-bottom">
      {MOBILE_NAV.map(({ label, icon: Icon, path }) => {
        const isActive =
          currentPath === path || currentPath.startsWith(path + "/");
        return (
          <NavLink
            key={path}
            to={path}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-body transition-colors",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
