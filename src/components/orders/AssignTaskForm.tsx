"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignTask } from "@/app/(dashboard)/tasks/actions";

type Worker = { id: string; full_name: string };
type OrderItem = { id: string; garment_type: string };

const TASK_TYPES = ["cutting", "stitching", "embroidery", "hand_work", "finishing", "alteration"];

export function AssignTaskForm({ orderId, workers, items }: { orderId: string; workers: Worker[]; items: OrderItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("order_id", orderId);
    const result = await assignTask(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-slate-500">Item</label>
        <select name="order_item_id" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Whole order</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.garment_type}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Task</label>
        <select name="task_type" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm capitalize">
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Assign to</label>
        <select name="assigned_to" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Select worker…</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Due date</label>
        <input name="due_date" type="date" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Pay</label>
        <input name="pay_amount" type="number" step="0.01" defaultValue={0} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
        {pending ? "Assigning…" : "Assign task"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
