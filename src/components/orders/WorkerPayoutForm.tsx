"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordWorkerPayout } from "@/app/(dashboard)/payments/actions";

export function WorkerPayoutForm({ workers }: { workers: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await recordWorkerPayout(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="block text-xs text-slate-500">Worker</label>
        <select name="worker_id" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Select worker…</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Amount</label>
        <input name="amount" type="number" step="0.01" required className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Method</label>
        <select name="method" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
        </select>
      </div>
      <input name="notes" placeholder="Notes (e.g. week ending...)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
        {pending ? "Paying…" : "Record payout"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
