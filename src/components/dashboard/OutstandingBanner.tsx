import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { currencyNGN } from "@/lib/reports/analytics";

export function OutstandingBanner({ amount, openOrders }: { amount: number; openOrders: number }) {
  if (amount <= 0) return null;
  return (
    <Link
      href="/payments"
      className="flex items-center gap-2 rounded-xl border border-accent-400 bg-accent-50 px-4 py-3 text-sm text-accent-600 transition hover:bg-accent-100"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">{currencyNGN(amount)}</strong> outstanding across {openOrders} open order
        {openOrders === 1 ? "" : "s"}. Click to review payments.
      </span>
    </Link>
  );
}
