"use client";

import { useState } from "react";
import type { BlockKey } from "@/lib/pattern/blockRegistry";

const BLOCKS: { key: BlockKey; label: string; description: string }[] = [
  { key: "skirt", label: "Skirt (front)", description: "Uses waist, hip, hip depth, skirt length." },
  { key: "skirt-back", label: "Skirt (back)", description: "Same fields as the front, drafted with a tighter waist ease." },
  { key: "bodice", label: "Bodice (front)", description: "Uses bust/chest, waist, shoulder, bodice length." },
  { key: "bodice-back", label: "Bodice (back)", description: "Same fields as the front, drafted narrower at the chest." },
  { key: "trouser", label: "Trouser (front)", description: "Uses waist, thigh, rise, inseam, ankle." },
  { key: "sleeve", label: "Sleeve — rough outline", description: "Uses bicep, sleeve length, wrist. Cap is not curved — see warning below." },
];

export function PdfDownloadLinks({ itemId }: { itemId: string }) {
  const [seam, setSeam] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Seam allowance for these PDFs (mm)</label>
        <input
          type="number"
          min={0}
          max={50}
          value={seam}
          onChange={(e) => setSeam(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate-400">0 = seamline only, no cutting-line offset</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {BLOCKS.map((b) => (
          <a
            key={b.key}
            href={`/patterns/${itemId}/pdf?block=${b.key}${seam > 0 ? `&seam=${seam}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-500 hover:bg-brand-50"
          >
            <p className="font-medium text-slate-800">{b.label}</p>
            <p className="text-sm text-slate-500">{b.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
