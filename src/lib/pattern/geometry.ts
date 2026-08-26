export type MeasurementValues = Record<string, string | number>;
export type MeasurementUnit = "in" | "cm";

export type PatternPiece = {
  name: string;
  /** SVG path data, in millimeters, origin at the piece's top-left-ish reference point. */
  pathMM: string;
  boundingBoxMM: { minX: number; maxX: number; minY: number; maxY: number };
};

export type PatternResult = {
  pieces: PatternPiece[];
  /** Measurement keys that were missing and had to be defaulted — surfaced to the user, never hidden. */
  warnings: string[];
};

/** Reads a numeric measurement value in millimeters, trying each key in order, falling back to a default. */
export function readMM(values: MeasurementValues, unit: MeasurementUnit, keys: string[], fallback: number, warnings: string[], label: string): number {
  for (const key of keys) {
    const raw = values[key];
    if (raw !== undefined && raw !== null && raw !== "") {
      const n = typeof raw === "number" ? raw : parseFloat(raw);
      if (!Number.isNaN(n) && n > 0) {
        return unit === "in" ? n * 25.4 : n * 10;
      }
    }
  }
  warnings.push(`${label} not measured — used a default of ${fallback}mm. Verify before cutting.`);
  return fallback;
}

export function boundingBoxOfPoints(points: [number, number][]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
