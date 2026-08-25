"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/app/(dashboard)/payments/actions";

export function RecordPaymentForm({ orderId, balance }: { orderId: string; balance: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("order_id", orderId);
    const result = await recordPayment(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (balance <= 0) {
    return <p className="text-sm text-emerald-700">Fully paid.</p>;
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-500">Amount (balance: {balance.toFixed(2)})</label>
        <input name="amount" type="number" step="0.01" max={balance} required className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Method</label>
        <select name="method" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="other">Other</option>
        </select>
      </div>
      <input name="reference" placeholder="Reference (optional)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
        {pending ? "Recording…" : "Record payment"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
