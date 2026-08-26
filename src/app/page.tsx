import Link from "next/link";
import { LogIn } from "lucide-react";

export default function HomePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream px-4 text-center"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(30,42,71,0.04) 0px, rgba(30,42,71,0.04) 1px, transparent 1px, transparent 48px)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-500">The Tailor&rsquo;s Command Centre</p>
      <h1 className="font-serif leading-tight">
        <span className="block text-5xl text-slate-800 sm:text-6xl">Atelier</span>
        <span className="block text-5xl font-bold text-brand-700 sm:text-6xl">HQ</span>
      </h1>
      <p className="max-w-md text-slate-500">
        Orders, customers, worker tasks, payments, and invoices — all in one elegant workspace for your tailoring business.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <LogIn className="h-4 w-4" />
          Sign In
        </Link>
        <Link
          href="/signup"
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-cream-100"
        >
          Start free trial
        </Link>
      </div>
    </main>
  );
}
