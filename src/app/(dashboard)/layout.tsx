import Link from "next/link";
import { Scissors } from "lucide-react";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/patternlab", label: "Patternlab" },
  { href: "/customers", label: "Customers" },
  { href: "/workers", label: "Workers" },
  { href: "/tasks", label: "Tasks" },
  { href: "/inventory", label: "Inventory" },
  { href: "/gallery", label: "Gallery" },
  { href: "/payments", label: "Payments" },
  { href: "/reports", label: "Reports" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();

  // Cheap, harmless call: is_platform_admin() only ever returns true/false
  // about the caller themselves, so this is safe from any authenticated
  // session — it just decides whether to show the "Admin console" link.
  const supabase = createServerSupabase();
  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="hidden w-60 shrink-0 bg-brand-800 px-4 py-6 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-2">
          <Scissors className="h-5 w-5 shrink-0 text-accent-400" />
          <p className="font-serif text-lg font-semibold leading-tight text-white">{user.tenantName}</p>
        </div>
        <p className="mt-0.5 pl-9 text-[11px] font-medium uppercase tracking-wider text-accent-400">AtelierHQ</p>

        <SidebarNav items={NAV} />

        <div className="mt-auto pt-6">
          {isPlatformAdmin && (
            <Link
              href="/admin"
              className="block rounded-md bg-white/10 px-3 py-2 text-center text-sm font-medium text-accent-400 hover:bg-white/15"
            >
              Admin console
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-800">{user.fullName}</span>{" "}
            <span className="text-xs uppercase text-slate-400">({user.role})</span>
          </p>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-slate-500 hover:text-slate-800">Sign out</button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
