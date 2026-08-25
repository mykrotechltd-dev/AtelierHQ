"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/app/(dashboard)/customers/actions";

export function NewCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createCustomer(formData);
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
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        + New customer
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">New customer</h2>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <input name="full_name" placeholder="Full name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Phone" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="whatsapp_number" placeholder="WhatsApp number (if different)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="Email (optional)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="address" placeholder="Address" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="notes" placeholder="Notes" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {pending ? "Saving…" : "Save customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
