"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorker } from "@/app/(dashboard)/workers/actions";
import { TASK_SPECIALTIES } from "@/lib/validations/worker";

export function NewWorkerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createWorker(formData);
    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
        + New worker
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">New worker</h2>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <input name="full_name" placeholder="Full name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Phone" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />

          <div>
            <label className="block text-xs text-slate-500">Specialties</label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {TASK_SPECIALTIES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm capitalize text-slate-700">
                  <input type="checkbox" name="specialties" value={s} />
                  {s.replace("_", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500">Pay rate type</label>
              <select name="pay_rate_type" defaultValue="per_task" className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="per_task">Per task</option>
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500">Pay rate</label>
              <input name="pay_rate" type="number" step="0.01" defaultValue={0} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {pending ? "Saving…" : "Save worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
