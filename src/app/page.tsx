import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">AtelierHQ</h1>
      <p className="max-w-md text-slate-600">
        The order management, measurement, invoicing and AI-assistant platform for tailoring shops.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          Start free trial
        </Link>
        <Link href="/login" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">
          Sign in
        </Link>
      </div>
    </main>
  );
}
