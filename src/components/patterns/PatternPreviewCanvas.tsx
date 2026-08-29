"use client";

import { useMemo, useState } from "react";
import { generateSkirtBlock } from "@/lib/pattern/skirtBlock";
import { generateBodiceBlock } from "@/lib/pattern/bodiceBlock";
import { pieceToStandaloneSvg } from "@/lib/pattern/svgExport";
import { readMM, offsetPolygon, pointsToClosedPathData, type MeasurementValues, type MeasurementUnit } from "@/lib/pattern/geometry";

// Rendered at this many CSS px per pattern-mm at 100% zoom; the zoom slider
// scales this, the SVG's viewBox always stays in true millimeters so the
// shape math never changes, only how big it's drawn.
const BASE_PX_PER_MM = 2;

type SkirtState = { waist: number; hip: number; hipDepth: number; skirtLength: number; waistEase: number; hipEase: number };
type BodiceState = { bust: number; waist: number; shoulder: number; bodiceLength: number; chestEase: number; waistEase: number };

function seedSkirtState(values: MeasurementValues, unit: MeasurementUnit): SkirtState {
  const w: string[] = []; // throwaway — this is just for seeding slider defaults, not shown anywhere
  return {
    waist: readMM(values, unit, ["waist"], 700, w, "Waist"),
    hip: readMM(values, unit, ["hip"], 960, w, "Hip"),
    hipDepth: readMM(values, unit, ["hip_depth"], 200, w, "Hip depth"),
    skirtLength: readMM(values, unit, ["skirt_length"], 600, w, "Skirt length"),
    waistEase: 10,
    hipEase: 20,
  };
}

function seedBodiceState(values: MeasurementValues, unit: MeasurementUnit): BodiceState {
  const w: string[] = [];
  return {
    bust: readMM(values, unit, ["bust", "chest"], 880, w, "Bust/chest"),
    waist: readMM(values, unit, ["waist"], 700, w, "Waist"),
    shoulder: readMM(values, unit, ["shoulder"], 380, w, "Shoulder"),
    bodiceLength: readMM(values, unit, ["blouse_length", "shirt_length", "gown_length"], 400, w, "Bodice length"),
    chestEase: 40,
    waistEase: 20,
  };
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 5,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{(value / 10).toFixed(1)}cm</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export function PatternPreviewCanvas({
  block,
  initialValues,
  initialUnit,
}: {
  block: "skirt" | "bodice";
  initialValues: MeasurementValues;
  initialUnit: MeasurementUnit;
}) {
  const [skirt, setSkirt] = useState<SkirtState>(() => seedSkirtState(initialValues, initialUnit));
  const [bodice, setBodice] = useState<BodiceState>(() => seedBodiceState(initialValues, initialUnit));
  const [zoom, setZoom] = useState(100);
  const [seamAllowance, setSeamAllowance] = useState(0);

  // Slider state is kept in millimeters (matching PatternPiece's own
  // coordinate convention), so it's converted to centimeters here purely to
  // call the generators through their normal (values, unit) contract — the
  // generators' readMM() converts cm back to mm internally, an exact
  // round-trip since both sides use the same *10 factor.
  const result = useMemo(() => {
    if (block === "skirt") {
      return generateSkirtBlock(
        { waist: skirt.waist / 10, hip: skirt.hip / 10, hip_depth: skirt.hipDepth / 10, skirt_length: skirt.skirtLength / 10 },
        "cm",
        { waistEaseMM: skirt.waistEase, hipEaseMM: skirt.hipEase }
      );
    }
    return generateBodiceBlock(
      { bust: bodice.bust / 10, waist: bodice.waist / 10, shoulder: bodice.shoulder / 10, blouse_length: bodice.bodiceLength / 10 },
      "cm",
      { chestEaseMM: bodice.chestEase, waistEaseMM: bodice.waistEase }
    );
  }, [block, skirt, bodice]);

  const piece = result.pieces[0];
  const cutPoints = piece && seamAllowance > 0 ? offsetPolygon(piece.points, seamAllowance) : null;
  const cutPath = cutPoints ? pointsToClosedPathData(cutPoints) : null;

  // Expand the viewBox to fit the offset cutting line too, when it's on.
  const bboxMinX = piece ? Math.min(piece.boundingBoxMM.minX, ...(cutPoints?.map((p) => p[0]) ?? [piece.boundingBoxMM.minX])) : 0;
  const bboxMinY = piece ? Math.min(piece.boundingBoxMM.minY, ...(cutPoints?.map((p) => p[1]) ?? [piece.boundingBoxMM.minY])) : 0;
  const bboxMaxX = piece ? Math.max(piece.boundingBoxMM.maxX, ...(cutPoints?.map((p) => p[0]) ?? [piece.boundingBoxMM.maxX])) : 0;
  const bboxMaxY = piece ? Math.max(piece.boundingBoxMM.maxY, ...(cutPoints?.map((p) => p[1]) ?? [piece.boundingBoxMM.maxY])) : 0;
  const widthMM = bboxMaxX - bboxMinX;
  const heightMM = bboxMaxY - bboxMinY;
  const scale = BASE_PX_PER_MM * (zoom / 100);

  function handleDownload() {
    if (!piece) return;
    const svgString = pieceToStandaloneSvg(piece, seamAllowance);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pattern-${block}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
      <div className="space-y-3">
        {block === "skirt" ? (
          <>
            <SliderField label="Waist" value={skirt.waist} min={500} max={1400} onChange={(v) => setSkirt((s) => ({ ...s, waist: v }))} />
            <SliderField label="Hip" value={skirt.hip} min={500} max={1400} onChange={(v) => setSkirt((s) => ({ ...s, hip: v }))} />
            <SliderField
              label="Hip depth"
              value={skirt.hipDepth}
              min={100}
              max={350}
              onChange={(v) => setSkirt((s) => ({ ...s, hipDepth: v }))}
            />
            <SliderField
              label="Skirt length"
              value={skirt.skirtLength}
              min={300}
              max={1200}
              onChange={(v) => setSkirt((s) => ({ ...s, skirtLength: v }))}
            />
            <SliderField
              label="Waist ease"
              value={skirt.waistEase}
              min={0}
              max={50}
              step={1}
              onChange={(v) => setSkirt((s) => ({ ...s, waistEase: v }))}
            />
            <SliderField
              label="Hip ease"
              value={skirt.hipEase}
              min={0}
              max={50}
              step={1}
              onChange={(v) => setSkirt((s) => ({ ...s, hipEase: v }))}
            />
          </>
        ) : (
          <>
            <SliderField label="Bust/chest" value={bodice.bust} min={500} max={1400} onChange={(v) => setBodice((s) => ({ ...s, bust: v }))} />
            <SliderField label="Waist" value={bodice.waist} min={500} max={1400} onChange={(v) => setBodice((s) => ({ ...s, waist: v }))} />
            <SliderField
              label="Shoulder width"
              value={bodice.shoulder}
              min={250}
              max={500}
              onChange={(v) => setBodice((s) => ({ ...s, shoulder: v }))}
            />
            <SliderField
              label="Bodice length"
              value={bodice.bodiceLength}
              min={250}
              max={700}
              onChange={(v) => setBodice((s) => ({ ...s, bodiceLength: v }))}
            />
            <SliderField
              label="Chest ease"
              value={bodice.chestEase}
              min={0}
              max={50}
              step={1}
              onChange={(v) => setBodice((s) => ({ ...s, chestEase: v }))}
            />
            <SliderField
              label="Waist ease"
              value={bodice.waistEase}
              min={0}
              max={50}
              step={1}
              onChange={(v) => setBodice((s) => ({ ...s, waistEase: v }))}
            />
          </>
        )}

        <div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Seam allowance</span>
            <span>{seamAllowance}mm</span>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={seamAllowance}
            onChange={(e) => setSeamAllowance(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Zoom</span>
            <span>{zoom}%</span>
          </div>
          <input type="range" min={50} max={300} step={10} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
        </div>

        <button onClick={handleDownload} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Download SVG
        </button>
      </div>

      <div>
        <div className="h-[400px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          {piece && (
            <svg width={widthMM * scale} height={heightMM * scale} viewBox={`${bboxMinX} ${bboxMinY} ${widthMM} ${heightMM}`}>
              {cutPath && <path d={cutPath} stroke="#b45309" strokeWidth={0.5} strokeDasharray="3,2" fill="none" />}
              <path d={piece.pathMM} stroke="#1e293b" strokeWidth={0.6} fill="none" />
            </svg>
          )}
        </div>
        {result.warnings.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
