"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-6 space-y-1">
      {items.map((item) => {
        const isActive = item.href === "/dashboard" ? pathname === item.href : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-accent-500 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
