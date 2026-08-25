"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { orderSchema, type OrderInput } from "@/lib/validations/order";
import { createOrder } from "@/app/(dashboard)/orders/actions";

type CustomerOption = { id: string; full_name: string; phone: string };

export function OrderForm({
  customers,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  defaultCustomerId?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: defaultCustomerId ?? "",
      discount: 0,
      items: [{ garment_type: "", quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  async function onSubmit(values: OrderInput) {
    setServerError(null);
    const result = await createOrder(values);
    // createOrder redirects on success, so reaching here means it failed.
    if (result?.error) setServerError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700">Customer</label>
        <select {...register("customer_id")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} ({c.phone})
            </option>
          ))}
        </select>
        {errors.customer_id && <p className="mt-1 text-xs text-red-600">{errors.customer_id.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Due date</label>
          <input type="date" {...register("due_date")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Discount</label>
          <input type="number" step="0.01" {...register("discount")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Items</h3>
          <button
            type="button"
            onClick={() => append({ garment_type: "", quantity: 1, unit_price: 0 })}
            className="text-sm text-brand-600 hover:underline"
          >
            + Add item
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 p-3">
              <input
                placeholder="Garment (e.g. Agbada)"
                {...register(`items.${index}.garment_type` as const)}
                className="col-span-4 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Description"
                {...register(`items.${index}.description` as const)}
                className="col-span-3 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                placeholder="Qty"
                {...register(`items.${index}.quantity` as const)}
                className="col-span-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Unit price"
                {...register(`items.${index}.unit_price` as const)}
                className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Fabric notes"
                {...register(`items.${index}.fabric_notes` as const)}
                className="col-span-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button type="button" onClick={() => remove(index)} className="col-span-1 text-sm text-red-500 hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
        {errors.items && <p className="mt-1 text-xs text-red-600">{errors.items.message as string}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Notes</label>
        <textarea {...register("notes")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {isSubmitting ? "Creating order…" : "Create order"}
      </button>
    </form>
  );
}
