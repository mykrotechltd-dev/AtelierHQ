/**
 * Bodice draft regression tests.
 *
 * Two jobs:
 *  - assert the drafting formulas produce the values the method specifies, for a
 *    known size, so a formula change cannot silently move a point;
 *  - assert the drawn geometry stays sane (portrait, in-bounds, no inverted
 *    armhole) across every size and for hostile input.
 */

import { describe, expect, it } from "vitest";
import { bodiceBack, bodiceFront, draftBodice } from "@/lib/pattern/bodice.ts";
import { calculateBodice } from "@/lib/pattern/bodice-calculator.ts";
import { BODICE, STANDARD_SIZES, UK_SIZES } from "@/lib/pattern/constants.ts";
import { distance } from "@/lib/pattern/points.ts";
import type { Measurements, PatternBlock } from "@/lib/pattern/types.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

/** Every coordinate pair in a `d` string, including Bézier control points. */
function allPoints(d: string): Pt[] {
  const pts: Pt[] = [];
  for (const part of d.trim().split(/(?=[MLQCZmlqcz])/)) {
    const letter = part[0]?.toUpperCase();
    if (!letter || letter === "Z") continue;
    const n = part.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) pts.push({ x: n[i], y: n[i + 1] });
  }
  return pts;
}

function outlineOf(block: PatternBlock): string {
  const outline = block.paths.find((p) => p.type === "outline");
  if (!outline) throw new Error(`${block.id} has no outline`);
  return outline.d;
}

function extent(d: string) {
  const pts = allPoints(d);
  return {
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
    minX: Math.min(...pts.map((p) => p.x)),
  };
}

/** UK 12, the size the method's worked example is easiest to check against. */
const UK12: Measurements = STANDARD_SIZES["12"];

/** The measurements from the original balloon bug report. */
const BUG_REPORT: Measurements = { chest: 84, waist: 60, shoulder: 21 };

// ── Framework formulas ────────────────────────────────────────────────────────

describe("bodice framework follows the drafting method", () => {
  it("derives armhole depth from bust", () => {
    const d = calculateBodice(UK12, "back");
    // bust/8 + 5 for bust 90 => 16.25
    expect(d.calc.armholeDepth).toBeCloseTo(90 / 8 + 5, 6);
  });

  it("adds a quarter of the bust ease to the bust quarter", () => {
    const d = calculateBodice(UK12, "back");
    expect(d.calc.bustQuarter).toBeCloseTo(90 / 4 + BODICE.easeBust / 4, 6);
  });

  it("adds a quarter of the waist ease to the waist quarter", () => {
    const d = calculateBodice(UK12, "back");
    expect(d.calc.waistQuarter).toBeCloseTo(71 / 4 + BODICE.easeWaist / 4, 6);
  });

  it("derives the back neck drop as a third of the neck width", () => {
    const d = calculateBodice(UK12, "back");
    expect(d.calc.neckDrop).toBeCloseTo(d.calc.neckWidth * (1 / 3), 6);
  });

  it("drops the front neck lower than the back", () => {
    const front = calculateBodice(UK12, "front");
    const back = calculateBodice(UK12, "back");
    expect(front.calc.neckDrop).toBeGreaterThan(back.calc.neckDrop);
  });

  it("estimates across-back from bust when not measured", () => {
    const d = calculateBodice(UK12, "back");
    expect(d.resolved.backWidth).toBeCloseTo(90 / 6 + 5.5, 6);
    expect(d.estimates.some((e) => e.field === "backWidth")).toBe(true);
  });

  it("prefers a measured across-back over the estimate", () => {
    const d = calculateBodice({ ...UK12, backWidth: 36 }, "back");
    expect(d.resolved.backWidth).toBe(36);
    expect(d.estimates.some((e) => e.field === "backWidth")).toBe(false);
  });
});

describe("shoulder construction", () => {
  it("keeps the shoulder seam exactly the measured length", () => {
    const d = calculateBodice({ chest: 90, waist: 71, shoulder: 13 }, "back");
    const seam = distance(d.points.neckPoint, d.points.shoulderPoint);
    expect(seam).toBeCloseTo(13, 6);
  });

  it("drops the shoulder by the slope constant", () => {
    const d = calculateBodice({ chest: 90, waist: 71, shoulder: 13 }, "back");
    const drop = d.points.shoulderPoint.y - d.points.neckPoint.y;
    expect(drop).toBeCloseTo(BODICE.shoulderSlopeDrop, 6);
  });

  it("reads a tip-to-tip shoulder measurement as cross-shoulder", () => {
    const d = calculateBodice({ chest: 90, waist: 71, shoulder: 39.5 }, "back");
    expect(d.diagnostics.some((x) => x.code === "SHOULDER_READ_AS_CROSS")).toBe(true);
    expect(d.resolved.shoulderLen).toBeLessThan(20);
    expect(d.resolved.shoulderLen).toBeGreaterThan(10);
  });

  it("reads a small shoulder value as a single seam", () => {
    const d = calculateBodice(BUG_REPORT, "back");
    expect(d.diagnostics.some((x) => x.code === "SHOULDER_READ_AS_SEAM")).toBe(true);
    expect(d.resolved.shoulderLen).toBe(21);
  });

  it("cuts the front shoulder shorter than the back by the dart intake", () => {
    const front = calculateBodice(UK12, "front");
    const back = calculateBodice(UK12, "back");
    const frontSeam = distance(front.points.neckPoint, front.points.shoulderPoint);
    const backSeam = distance(back.points.neckPoint, back.points.shoulderPoint);
    expect(backSeam - frontSeam).toBeCloseTo(BODICE.backShoulderDartIntake, 4);
  });
});

// ── Darts ─────────────────────────────────────────────────────────────────────

describe("bust dart", () => {
  it("places the apex from the bust point measurements", () => {
    const m = { ...UK12, bustPointSep: 19, shoulderToBust: 26 };
    const d = calculateBodice(m, "front");
    expect(d.points.bustPoint?.x).toBeCloseTo(9.5, 6);
    expect(d.points.bustPoint?.y).toBeCloseTo(26, 6);
  });

  it("opens the dart to the calculated intake", () => {
    const d = calculateBodice(UK12, "front");
    expect(d.bustDart).toBeDefined();
    const gap = distance(d.bustDart!.legStart, d.bustDart!.legEnd);
    expect(gap).toBeCloseTo(d.bustDart!.intake, 4);
  });

  it("keeps both dart legs the same length", () => {
    const d = calculateBodice(UK12, "front");
    const dart = d.bustDart!;
    expect(distance(dart.apex, dart.legStart)).toBeCloseTo(distance(dart.apex, dart.legEnd), 6);
  });

  it("scales the dart with the bust-to-waist differential", () => {
    const small = calculateBodice({ chest: 88, waist: 80, shoulder: 13 }, "front");
    const large = calculateBodice({ chest: 110, waist: 70, shoulder: 13 }, "front");
    expect(large.calc.bustDartIntake).toBeGreaterThan(small.calc.bustDartIntake);
  });

  it("clamps the dart intake to a workable range", () => {
    const extreme = calculateBodice({ chest: 160, waist: 55, shoulder: 13 }, "front");
    expect(extreme.calc.bustDartIntake).toBeLessThanOrEqual(BODICE.bustDartIntakeRange.max);
    const flat = calculateBodice({ chest: 85, waist: 84, shoulder: 13 }, "front");
    expect(flat.calc.bustDartIntake).toBeGreaterThanOrEqual(BODICE.bustDartIntakeRange.min);
  });

  it("gives the back a shoulder dart and no bust dart", () => {
    const d = calculateBodice(UK12, "back");
    expect(d.shoulderDart).toBeDefined();
    expect(d.bustDart).toBeUndefined();
    expect(d.calc.shoulderDartIntake).toBeCloseTo(BODICE.backShoulderDartIntake, 4);
  });
});

describe("waist suppression", () => {
  it("splits suppression between the side seam and the dart", () => {
    const d = calculateBodice(UK12, "back");
    expect(d.calc.sideSeamIntake + d.calc.waistDartIntake).toBeCloseTo(d.calc.waistSuppression, 6);
  });

  it("warns and suppresses nothing when the waist exceeds the bust", () => {
    const d = calculateBodice({ chest: 80, waist: 100, shoulder: 13 }, "back");
    expect(d.calc.waistSuppression).toBe(0);
    expect(d.calc.waistDartIntake).toBe(0);
    expect(d.diagnostics.some((x) => x.code === "NO_WAIST_SUPPRESSION")).toBe(true);
  });
});

// ── Geometry sanity ───────────────────────────────────────────────────────────

describe("bodice geometry stays sane", () => {
  const panels = ["front", "back"] as const;

  it.each(panels)("%s draft is portrait and inside its viewBox", (panel) => {
    const block = draftBodice(BUG_REPORT, panel);
    const d = outlineOf(block);
    const e = extent(d);

    // A bodice panel is taller than it is wide. The old balloon bug failed this.
    expect(e.maxX).toBeLessThan(e.maxY);
    expect(e.maxX).toBeLessThanOrEqual(block.viewBox.x + block.viewBox.w);
    expect(e.maxY).toBeLessThanOrEqual(block.viewBox.y + block.viewBox.h);
    expect(e.minX).toBeGreaterThanOrEqual(block.viewBox.x);
  });

  it.each(panels)("%s armhole never crosses the side seam", (panel) => {
    const block = draftBodice(UK12, panel);
    const draft = calculateBodice(UK12, panel);
    // No point on the outline may sit outside the underarm, which is the widest
    // point of the block at armhole level.
    const widest = Math.max(draft.points.underarm.x, draft.points.waistSide.x);
    for (const p of allPoints(outlineOf(block))) {
      expect(p.x).toBeLessThanOrEqual(widest + 0.001);
    }
  });

  it.each(panels)("%s uses a cubic armhole", (panel) => {
    const block = draftBodice(UK12, panel);
    expect(outlineOf(block)).toContain("C ");
  });

  it.each(UK_SIZES)("UK %s drafts finite, portrait blocks", (size) => {
    for (const panel of panels) {
      const block = draftBodice(STANDARD_SIZES[size], panel);
      expect(block.missingMeasurements).toEqual([]);
      const d = outlineOf(block);
      for (const p of allPoints(d)) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
      const e = extent(d);
      expect(e.maxX).toBeLessThan(e.maxY);
      expect(e.maxX).toBeLessThanOrEqual(block.viewBox.x + block.viewBox.w);
    }
  });

  it("computes the viewBox from real geometry, not an estimate", () => {
    const block = draftBodice(UK12, "front");
    const all = block.paths.flatMap((p) => allPoints(p.d));
    const maxX = Math.max(...all.map((p) => p.x));
    const right = block.viewBox.x + block.viewBox.w;
    // Contains everything drawn, without a large unexplained gap.
    expect(right).toBeGreaterThanOrEqual(maxX);
    expect(right - maxX).toBeLessThan(10);
  });
});

// ── Validation and disclosure ────────────────────────────────────────────────

describe("validation and disclosure", () => {
  it("reports missing measurements rather than drafting a broken block", () => {
    const block = bodiceFront({ chest: 84 });
    expect(block.missingMeasurements).toContain("waist");
    expect(block.missingMeasurements).toContain("shoulder");
    expect(block.paths).toEqual([]);
  });

  it("rejects a zero or negative measurement", () => {
    const block = bodiceFront({ chest: 0, waist: 60, shoulder: 13 });
    expect(block.missingMeasurements).toContain("chest");
  });

  it("discloses every estimated measurement", () => {
    const block = bodiceFront(BUG_REPORT);
    const estimated = block.estimates.map((e) => e.field);
    // No neck, across-back or bust-point data was supplied.
    expect(estimated).toContain("neck");
    expect(estimated).toContain("backWidth");
    expect(estimated).toContain("bustPointSep");
    expect(block.diagnostics.some((d) => d.code === "MEASUREMENT_ESTIMATED")).toBe(true);
  });

  it("prefers a measured nape-to-waist over a height ratio", () => {
    const withMeasure = calculateBodice({ ...UK12, backNeckToWaist: 42.5 }, "back");
    expect(withMeasure.resolved.bodiceLength).toBe(42.5);
    expect(withMeasure.estimates.some((e) => e.field === "backNeckToWaist")).toBe(false);

    const fromHeight = calculateBodice(UK12, "back");
    expect(fromHeight.estimates.some((e) => e.field === "backNeckToWaist")).toBe(true);
  });

  it("warns when the waist is wider than the hips", () => {
    const block = bodiceBack({ chest: 90, waist: 110, hips: 96, shoulder: 13 });
    expect(block.diagnostics.some((d) => d.code === "WAIST_EXCEEDS_HIP")).toBe(true);
  });

  it("warns on a measurement that looks like a units mix-up", () => {
    const block = bodiceBack({ chest: 35, waist: 28, shoulder: 13 });
    expect(block.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("always advises verifying before cutting", () => {
    const block = bodiceFront(UK12);
    expect(block.diagnostics.some((d) => d.code === "VERIFY_BEFORE_CUTTING")).toBe(true);
    expect(block.diagnostics.some((d) => d.code === "NO_SEAM_ALLOWANCE")).toBe(true);
  });

  it("marks the back as cut on fold", () => {
    expect(bodiceBack(UK12).metadata.cutOnFold).toBe(true);
    expect(bodiceFront(UK12).metadata.cutOnFold).toBe(false);
  });

  it("exposes drafting values for inspection", () => {
    const block = bodiceFront(UK12);
    expect(block.calculations.armholeDepth).toBeGreaterThan(0);
    expect(block.calculations.bustQuarter).toBeGreaterThan(0);
    expect(block.calculations.bustDartIntake).toBeGreaterThan(0);
  });
});
