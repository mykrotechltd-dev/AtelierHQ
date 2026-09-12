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
} from "lucide-react";

const MOBILE_NAV = [
  { label: "Home", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Orders", icon: ClipboardList, path: "/admin/orders" },
  { label: "Clients", icon: Users, path: "/admin/clients" },
  { label: "Schedule", icon: CalendarDays, path: "/admin/schedule" },
  { label: "Inventory", icon: Boxes, path: "/admin/inventory" },
  { label: "Staff", icon: UserCheck, path: "/admin/staff" },
  { label: "Shops", icon: Store, path: "/admin/shops" },
];

export default function AdminMobileNav({
  currentPath,
}: {
  currentPath: string;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around overflow-x-auto border-t border-border bg-background md:hidden z-40 safe-area-bottom">
      {MOBILE_NAV.map(({ label, icon: Icon, path }) => {
        const isActive =
          currentPath === path || currentPath.startsWith(path + "/");
        return (
          <NavLink
            key={path}
            to={path}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 px-2.5 text-[11px] font-body transition-colors shrink-0",
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
