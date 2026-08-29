"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMeasurement } from "@/app/(dashboard)/customers/actions";

// Suggested field sets per garment type — purely a UX shortcut; the schema
// stores an open jsonb map, so shops can add custom fields for any garment.
const PRESETS: Record<string, string[]> = {
  shirt: ["chest", "waist", "shoulder", "bicep", "sleeve_length", "neck", "shirt_length"],
  trouser: ["waist", "hip", "rise", "inseam", "outseam", "thigh", "ankle"],
  skirt: ["waist", "hip", "hip_depth", "skirt_length"],
  agbada: ["chest", "shoulder", "sleeve_length", "agbada_length", "neck"],
  suit: ["chest", "waist", "shoulder", "sleeve_length", "jacket_length", "trouser_waist", "inseam"],
  blouse: ["bust", "waist", "hip", "shoulder", "bicep", "sleeve_length", "blouse_length"],
  gown: ["bust", "waist", "hip", "shoulder", "bicep", "gown_length", "sleeve_length"],
  custom: [],
};

export function MeasurementForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [garmentType, setGarmentType] = useState("shirt");
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries((PRESETS.shirt ?? []).map((f) => [f, ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changeGarment(type: string) {
    setGarmentType(type);
    setFields(Object.fromEntries((PRESETS[type] ?? []).map((f) => [f, ""])));
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const values = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== ""));
    formData.set("customer_id", customerId);
    formData.set("garment_type", garmentType);
    formData.set("values", JSON.stringify(values));

    const result = await addMeasurement(formData);
    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <select
          value={garmentType}
          onChange={(e) => changeGarment(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {Object.keys(PRESETS).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input name="label" placeholder="Label (e.g. Wedding suit 2026)" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="unit" defaultValue="in" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="in">inches</option>
          <option value="cm">cm</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.keys(fields).map((key) => (
          <div key={key}>
            <label className="block text-xs capitalize text-slate-500">{key.replace(/_/g, " ")}</label>
            <input
              type="number"
              step="0.25"
              value={fields[key]}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={pending} className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
        {pending ? "Saving…" : "Save measurement"}
      </button>
    </form>
  );
}
