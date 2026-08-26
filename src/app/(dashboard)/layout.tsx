import Link from "next/link";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { createServerSupabase } from "@/lib/supabase/server";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
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
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:block">
        <p className="px-2 text-lg font-semibold text-brand-600">AtelierHQ</p>
        <p className="mt-0.5 px-2 text-xs text-slate-400">{user.tenantName}</p>
        <nav className="mt-6 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {isPlatformAdmin && (
          <Link
            href="/admin"
            className="mt-6 block rounded-md bg-slate-900 px-2 py-2 text-center text-sm font-medium text-amber-400 hover:bg-slate-800"
          >
            Admin console
          </Link>
        )}
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
