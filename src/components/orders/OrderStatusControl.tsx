"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/(dashboard)/orders/actions";
import { ALLOWED_STATUS_TRANSITIONS } from "@/lib/validations/order";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function OrderStatusControl({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const next = ALLOWED_STATUS_TRANSITIONS[status] ?? [];

  async function move(to: string) {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("status", to);
    const result = await updateOrderStatus(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={status} />
      {next.map((s) => (
        <button
          key={s}
          disabled={pending}
          onClick={() => move(s)}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium capitalize text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Mark {s.replace("_", " ")}
        </button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
