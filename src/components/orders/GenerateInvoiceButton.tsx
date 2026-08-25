"use client";

import { useState } from "react";

export function GenerateInvoiceButton({ orderId, customerWhatsapp }: { orderId: string; customerWhatsapp?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/invoices/${orderId}?share=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate invoice");
      window.open(data.whatsappShareUrl, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/invoices/${orderId}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        View / Print invoice
      </a>
      <button
        onClick={handleShare}
        disabled={loading}
        className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
        title={customerWhatsapp ? `Share to ${customerWhatsapp}` : "Share via WhatsApp"}
      >
        {loading ? "Preparing…" : "Share via WhatsApp"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
