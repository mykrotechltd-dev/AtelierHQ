import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/utils/admin";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tenants", label: "Tenants" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-56 shrink-0 border-r border-slate-800 px-4 py-6 md:block">
        <p className="px-2 text-lg font-semibold text-amber-400">AtelierHQ Admin</p>
        <p className="mt-0.5 truncate px-2 text-xs text-slate-500">{admin.email}</p>
        <nav className="mt-6 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard" className="mt-8 block px-2 text-xs text-slate-500 hover:text-slate-300">
          ← Back to shop dashboard
        </Link>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
          <p className="text-sm text-slate-400">Platform-wide view — spans every tenant on AtelierHQ.</p>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-slate-400 hover:text-white">Sign out</button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
