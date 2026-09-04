/**
 * Pattern engine geometry regression tests.
 *
 * These lock down the bodice/dress armhole geometry after a bug where the
 * armhole control point was placed far outside the side seam, ballooning the
 * panel into a round blob instead of a bodice shape.
 */

import { describe, expect, it } from "vitest";
import {
  bodiceFront,
  bodiceBack,
  dressFront,
  dressBack,
  STANDARD_SIZES,
  type Measurements,
  type PatternBlock,
} from "@/lib/pattern-engine.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

/** Extract every coordinate pair (anchors AND control points) from a path `d`. */
function allPoints(d: string): Pt[] {
  const pts: Pt[] = [];
  const parts = d.trim().split(/(?=[MLQCZmlqcz])/);
  for (const part of parts) {
    const letter = part[0].toUpperCase();
    if (letter === "Z") continue;
    const n = part
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) {
      pts.push({ x: n[i], y: n[i + 1] });
    }
  }
  return pts;
}

function outlineOf(block: PatternBlock): string {
  const outline = block.paths.find((p) => p.type === "outline");
  if (!outline) throw new Error(`${block.id} has no outline path`);
  return outline.d;
}

/** Widest x reached by the outline, including control points. */
function maxX(d: string): number {
  return Math.max(...allPoints(d).map((p) => p.x));
}

function maxY(d: string): number {
  return Math.max(...allPoints(d).map((p) => p.y));
}

// The measurements from the reported bug report: shoulder given as a single
// shoulder seam (21 cm) rather than a cross-shoulder measurement.
const BUG_REPORT: Measurements = { chest: 84, waist: 60, shoulder: 21 };

const BODICE_BUILDERS = [
  { name: "bodiceFront", fn: bodiceFront },
  { name: "bodiceBack", fn: bodiceBack },
] as const;

const ALL_BUILDERS = [
  ...BODICE_BUILDERS,
  { name: "dressFront", fn: dressFront },
  { name: "dressBack", fn: dressBack },
] as const;

/** Dress blocks additionally require hips. */
function measurementsFor(name: string, base: Measurements): Measurements {
  return name.startsWith("dress") ? { hips: 90, ...base } : base;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pattern engine — armhole geometry", () => {
  it.each(ALL_BUILDERS)(
    "$name keeps every outline point inside the block width",
    ({ name, fn }) => {
      const block = fn(measurementsFor(name, BUG_REPORT));
      expect(block.missingMeasurements).toEqual([]);

      const d = outlineOf(block);
      const widest = maxX(d);
      // viewBox is padded, so the outline must fit comfortably within it.
      expect(widest).toBeLessThanOrEqual(block.viewBox.x + block.viewBox.w);
      // The block must not be wider than it is tall — a bodice panel is a
      // portrait shape. The old bug produced a near-circular blob.
      expect(widest).toBeLessThan(maxY(d));
    }
  );

  it.each(ALL_BUILDERS)("$name never places a point at negative x", ({ name, fn }) => {
    const block = fn(measurementsFor(name, BUG_REPORT));
    for (const p of allPoints(outlineOf(block))) {
      expect(p.x).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it.each(ALL_BUILDERS)("$name uses a cubic armhole curve", ({ name, fn }) => {
    const block = fn(measurementsFor(name, BUG_REPORT));
    const armhole = block.paths.find((p) => p.d.includes("C ") && p.type === "construction");
    expect(armhole, `${name} should expose a cubic armhole construction line`).toBeDefined();
  });
});

describe("pattern engine — shoulder measurement conventions", () => {
  it.each(BODICE_BUILDERS)(
    "$name reads 21 cm as a single shoulder seam",
    ({ fn }) => {
      const block = fn({ chest: 84, waist: 60, shoulder: 21 });
      const note = block.notes.find((n) => n.startsWith("Shoulder seam:"));
      expect(note).toContain("single shoulder");
    }
  );

  it.each(BODICE_BUILDERS)(
    "$name halves a 39.5 cm cross-shoulder measurement",
    ({ fn }) => {
      const block = fn({ chest: 90, waist: 71, shoulder: 39.5 });
      const note = block.notes.find((n) => n.startsWith("Shoulder seam:"));
      expect(note).toContain("cross-shoulder");
      // 39.5 / 2 minus neck width lands in a realistic 11–16 cm band.
      const seam = Number(note?.match(/Shoulder seam: ([\d.]+)/)?.[1]);
      expect(seam).toBeGreaterThan(10);
      expect(seam).toBeLessThan(17);
    }
  );

  it.each(BODICE_BUILDERS)("$name clamps an absurdly large shoulder", ({ fn }) => {
    const block = fn({ chest: 84, waist: 60, shoulder: 90 });
    const d = outlineOf(block);
    // Even with nonsense input the panel stays portrait and in-bounds.
    expect(maxX(d)).toBeLessThan(maxY(d));
    expect(maxX(d)).toBeLessThanOrEqual(block.viewBox.x + block.viewBox.w);
  });

  it.each(BODICE_BUILDERS)("$name clamps an absurdly small shoulder", ({ fn }) => {
    const block = fn({ chest: 84, waist: 60, shoulder: 1 });
    const seam = Number(
      block.notes
        .find((n) => n.startsWith("Shoulder seam:"))
        ?.match(/Shoulder seam: ([\d.]+)/)?.[1]
    );
    // Never collapses to zero — a shoulder seam must remain drawable.
    expect(seam).toBeGreaterThanOrEqual(4);
  });
});

describe("pattern engine — every standard UK size stays valid", () => {
  const sizes = Object.entries(STANDARD_SIZES);

  it.each(sizes)("UK %s produces sane bodice blocks", (_size, m) => {
    for (const { name, fn } of ALL_BUILDERS) {
      const block = fn(measurementsFor(name, m));
      expect(block.missingMeasurements).toEqual([]);

      const d = outlineOf(block);
      for (const p of allPoints(d)) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
      // Portrait orientation and within the declared viewBox.
      expect(maxX(d)).toBeLessThan(maxY(d));
      expect(maxX(d)).toBeLessThanOrEqual(block.viewBox.x + block.viewBox.w);
    }
  });
});

describe("pattern engine — missing measurements", () => {
  it("reports missing measurements instead of drawing a broken block", () => {
    const block = bodiceFront({ chest: 84 });
    expect(block.missingMeasurements).toContain("waist");
    expect(block.missingMeasurements).toContain("shoulder");
  });
});
