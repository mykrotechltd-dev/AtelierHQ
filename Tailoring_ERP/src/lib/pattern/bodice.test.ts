/**
 * Bodice draft regression tests — Lety Antony / Helen Joseph-Armstrong method
 * (ported from PatternLab's FrontBodiceDashboard.tsx; see bodice-calculator.ts
 * for the full port commentary).
 *
 * Three jobs:
 *  - numerically verify the port against an independent reference
 *    transcription of PatternLab's own raw (inches, Y-up) formulas, for
 *    several measurement sets — this is the "matches PatternLab" check;
 *  - assert the drafted geometry stays sane (closed outline, in-bounds,
 *    side seam matches between front and back "by construction");
 *  - assert the degenerate-input fallbacks (invalid neck-width triangle,
 *    fully-estimated measurements) still produce a drawable block.
 */

import { describe, expect, it } from "vitest";
import { bodiceBack, bodiceFront, draftBodice } from "@/lib/pattern/bodice.ts";
import { calculateBodice } from "@/lib/pattern/bodice-calculator.ts";
import { BODICE } from "@/lib/pattern/constants.ts";
import type { Measurements, PatternBlock } from "@/lib/pattern/types.ts";

// ── Reference implementation ──────────────────────────────────────────────────
//
// An independent transcription of PatternLab's own raw (inches, Y-up,
// negative-x-toward-side) formulas from `computeFrontBodicePoints` /
// `computeBackBodicePoints`, deliberately NOT sharing code with
// bodice-calculator.ts, so a bug introduced in the port shows up as a
// mismatch here. Works entirely in inches — this engine's own native unit
// too, so the only transform needed at the point of comparison (`toEngine`)
// is the frame flip, not a unit conversion.

type Pt = { x: number; y: number };

function angleBetween(a: Pt, b: Pt): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function pointAtAngle(o: Pt, angle: number, d: number): Pt {
  return { x: o.x + d * Math.cos(angle), y: o.y + d * Math.sin(angle) };
}
function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function shortSide(hyp: number, leg: number): number {
  return Math.sqrt(Math.max(hyp * hyp - leg * leg, 0));
}
/** Raw (PatternLab-frame) point → this engine's frame: negate x and y
 *  together. No unit conversion — both sides are already inches. */
function toEngine(p: Pt): Pt {
  return { x: -p.x, y: -p.y };
}

type RefMeasurements = {
  bust: number;
  waist: number;
  bustSpan: number;
  shoulderWidth: number;
  shoulderDrop: number;
  shoulderSeamLength: number;
  sideSeamLength: number;
  backBodiceLength: number;
  frontBodiceLength: number;
  centerFrontLength: number;
  bustDepth: number;
  acrossChestWidth: number;
  centerBackLength: number;
  acrossBackWidthProvided: boolean;
  acrossBackWidth: number;
  hasShoulderDart: boolean;
  hasSwaybackContour: boolean;
};

function referenceFront(m: RefMeasurements) {
  const A: Pt = { x: 0, y: 0 };
  const B: Pt = { x: A.x, y: A.y - m.frontBodiceLength };
  const C: Pt = { x: A.x, y: B.y + m.centerFrontLength };
  let neckWidth =
    m.shoulderWidth / 2 - shortSide(m.shoulderSeamLength, m.shoulderDrop);
  if (Number.isNaN(neckWidth) || neckWidth <= 0) neckWidth = 2.75;
  const F: Pt = { x: A.x - neckWidth, y: A.y };
  const D: Pt = { x: A.x - m.shoulderWidth / 2, y: A.y };
  const G: Pt = { x: D.x, y: D.y - m.shoulderDrop };
  const H: Pt = { x: A.x - m.bustSpan / 2, y: A.y - m.bustDepth };
  let armholeEase: number;
  if (m.bust >= 50) armholeEase = 2.5;
  else if (m.bust >= 40) armholeEase = 2.0;
  else armholeEase = 1.5;
  const armholeDepth = m.bust / 6 + armholeEase;
  const K: Pt = {
    x: A.x - m.bust / 4,
    y: A.y - (m.shoulderDrop + armholeDepth),
  };
  const midCFY = (C.y + K.y) / 2;
  const I: Pt = { x: A.x - m.acrossChestWidth / 2 - 0.25, y: midCFY };
  const dartPlacementDist = m.bustSpan / 2 - 0.5;
  const J: Pt = { x: B.x - dartPlacementDist, y: B.y };
  const J1: Pt = { x: J.x, y: J.y - 0.125 };
  const leg1Length = dist(H, J1);
  const deltaL = m.frontBodiceLength - m.backBodiceLength;
  let sideExtensionVal: number;
  if (deltaL >= 3.0) sideExtensionVal = 1.5;
  else if (deltaL > 1.0) sideExtensionVal = 1.25;
  else sideExtensionVal = 0.0;
  const L: Pt = { x: K.x, y: K.y - m.sideSeamLength };
  const M: Pt = { x: L.x - sideExtensionVal, y: L.y };
  const angleKM = angleBetween(K, M);
  const N: Pt = pointAtAngle(K, angleKM, m.sideSeamLength);
  const remainingWaistDist = m.waist / 4 - dartPlacementDist;
  const angleNJ1 = angleBetween(N, J1);
  const waistAnchorForP = pointAtAngle(N, angleNJ1, remainingWaistDist);
  const angleHAnchor = angleBetween(H, waistAnchorForP);
  const P: Pt = pointAtAngle(H, angleHAnchor, leg1Length);
  return { A, B, C, D, F, G, H, I, J, J1, K, L, M, N, P };
}

function referenceBack(m: RefMeasurements) {
  const acrossBackHalf = m.acrossBackWidthProvided
    ? m.acrossBackWidth / 2 + 0.25
    : m.shoulderWidth / 2 - 0.25;

  const A: Pt = { x: 0, y: 0 };
  const B: Pt = { x: A.x, y: A.y - m.backBodiceLength };
  const C: Pt = { x: B.x, y: B.y + m.centerBackLength };
  const D: Pt = { x: A.x + m.shoulderWidth / 2, y: A.y };
  const E: Pt = { x: D.x, y: D.y - m.shoulderDrop };
  const dyF = Math.abs(A.y - E.y);
  const dxF = shortSide(m.shoulderSeamLength, dyF);
  const F: Pt = { x: E.x - dxF, y: A.y };

  let E1: Pt = E;
  let P: Pt = { x: 0, y: 0 };
  let P1: Pt = { x: 0, y: 0 };
  let P2: Pt = { x: 0, y: 0 };
  let Q: Pt = { x: 0, y: 0 };
  if (m.hasShoulderDart) {
    const angleFE = angleBetween(F, E);
    E1 = pointAtAngle(E, angleFE, 0.5);
    P = { x: (F.x + E1.x) / 2, y: (F.y + E1.y) / 2 };
    P1 = pointAtAngle(P, angleFE, -0.25);
    P2 = pointAtAngle(P, angleFE, 0.25);
  }

  let BActive: Pt = B;
  let cbAngle = -Math.PI / 2;
  if (m.hasSwaybackContour) {
    const B1: Pt = { x: B.x + 0.75, y: B.y };
    cbAngle = angleBetween(C, B1);
    BActive = pointAtAngle(C, cbAngle, m.centerBackLength);
  }

  const dartPlacement = m.bustSpan / 2 - 0.5;
  let G: Pt, H: Pt, I: Pt, J: Pt, G1: Pt;
  if (!m.hasSwaybackContour) {
    G = { x: BActive.x + dartPlacement, y: BActive.y };
    H = { x: G.x + 1.0, y: G.y };
    I = { x: (G.x + H.x) / 2, y: G.y };
    J = { x: I.x, y: I.y + (m.sideSeamLength - 1.0) };
    G1 = { x: G.x, y: G.y };
  } else {
    const waistAngle = cbAngle + Math.PI / 2;
    G = pointAtAngle(BActive, waistAngle, dartPlacement);
    H = pointAtAngle(G, waistAngle, 1.0);
    I = { x: (G.x + H.x) / 2, y: (G.y + H.y) / 2 };
    J = pointAtAngle(I, cbAngle, -(m.sideSeamLength - 1.0));
    const jhLength = dist(H, J);
    const angleJG = angleBetween(J, G);
    G1 = pointAtAngle(J, angleJG, jhLength);
  }
  if (m.hasShoulderDart) {
    const anglePJ = angleBetween(P, J);
    Q = pointAtAngle(P, anglePJ, m.sideSeamLength / 3 + 1.0);
  }
  let K: Pt;
  if (!m.hasSwaybackContour) {
    K = { x: H.x + (m.waist / 4 - dartPlacement), y: H.y };
  } else {
    K = { x: BActive.x + (m.waist / 4 + 1.0), y: B.y };
  }
  const L: Pt = { x: K.x, y: K.y + m.sideSeamLength };
  let M: Pt = { x: A.x, y: L.y };
  if (m.hasSwaybackContour) {
    M = { x: C.x + Math.abs(L.y - C.y) / Math.tan(Math.abs(cbAngle)), y: L.y };
  }
  const N: Pt = { x: M.x + m.bust / 4, y: M.y };
  const angleKN = angleBetween(K, N);
  const O: Pt = pointAtAngle(K, angleKN, m.sideSeamLength);
  const midCmY = (C.y + M.y) / 2;
  const R: Pt = { x: A.x + acrossBackHalf, y: midCmY };

  return {
    A,
    B,
    C,
    D,
    E,
    F,
    E1,
    P,
    P1,
    P2,
    Q,
    BActive,
    G,
    H,
    I,
    J,
    G1,
    K,
    L,
    M,
    N,
    O,
    R,
  };
}

/** Builds the ERP `Measurements` object that should reproduce `m` exactly —
 *  every field the calculator would otherwise estimate is supplied directly,
 *  in inches (this engine's native unit, same as the reference), so the
 *  comparison below tests the point-placement/curve-handle port, not the
 *  estimation formulas (those get their own test below). */
function toErpMeasurements(
  m: RefMeasurements,
  shoulder: { neck: number; shoulderIn: number },
): Measurements {
  return {
    chest: m.bust,
    waist: m.waist,
    neck: shoulder.neck,
    shoulder: shoulder.shoulderIn,
    bustPointSep: m.bustSpan,
    frontNeckToWaist: m.frontBodiceLength,
    backNeckToWaist: m.backBodiceLength,
    shoulderDrop: m.shoulderDrop,
    bustDepth: m.bustDepth,
    centerFrontLength: m.centerFrontLength,
    acrossChestWidth: m.acrossChestWidth,
    centerBackLength: m.centerBackLength,
    acrossBackWidth: m.acrossBackWidthProvided ? m.acrossBackWidth : undefined,
    sideSeamLength: m.sideSeamLength,
  };
}

/** Solves for an ERP `shoulder` (cross-shoulder, inches) + `neck` (inches)
 *  pair that reproduces the reference's independent `shoulderWidth`/
 *  `shoulderSeamLength` exactly, using the same algebra as
 *  bodice-calculator.ts's cross-shoulder branch: `shoulderWidth =
 *  shoulderRaw`, `shoulderSeamLength = shoulderRaw/2 - neck/5`. */
function shoulderInputsFor(m: RefMeasurements): {
  neck: number;
  shoulderIn: number;
} {
  const shoulderIn = m.shoulderWidth;
  const neckGapIn = shoulderIn / 2 - m.shoulderSeamLength;
  return { neck: neckGapIn * 5, shoulderIn };
}

const REFERENCE_SETS: { name: string; m: RefMeasurements }[] = [
  {
    // PatternLab's own sample defaults, verbatim.
    name: "PatternLab defaults (bust 42in)",
    m: {
      bust: 42.0,
      waist: 32.0,
      bustSpan: 8.0,
      shoulderWidth: 15.0,
      shoulderDrop: 0.75,
      shoulderSeamLength: 5.0,
      sideSeamLength: 6.5,
      backBodiceLength: 15.0,
      frontBodiceLength: 18.0,
      centerFrontLength: 14.5,
      bustDepth: 10.5,
      acrossChestWidth: 13.5,
      centerBackLength: 14.5,
      acrossBackWidthProvided: true,
      acrossBackWidth: 14.0,
      hasShoulderDart: true,
      hasSwaybackContour: true,
    },
  },
  {
    // A smaller frame, dart/swayback toggles both on — proves the port
    // generalises beyond the one shipped sample.
    name: "Smaller frame (bust 34in), toggles on",
    m: {
      bust: 34.0,
      waist: 26.0,
      bustSpan: 7.0,
      shoulderWidth: 13.5,
      shoulderDrop: 0.6,
      shoulderSeamLength: 4.5,
      sideSeamLength: 6.0,
      backBodiceLength: 14.0,
      frontBodiceLength: 16.5,
      centerFrontLength: 13.0,
      bustDepth: 9.0,
      acrossChestWidth: 12.0,
      centerBackLength: 13.5,
      acrossBackWidthProvided: true,
      acrossBackWidth: 12.5,
      hasShoulderDart: true,
      hasSwaybackContour: true,
    },
  },
  {
    // A larger frame with both back toggles OFF and across-back width NOT
    // provided (fallback branch) — proves both branches of the back
    // construction and the armhole-ease top tier (bust >= 50in).
    name: "Larger frame (bust 52in), toggles off, across-back fallback",
    m: {
      bust: 52.0,
      waist: 44.0,
      bustSpan: 9.5,
      shoulderWidth: 16.5,
      shoulderDrop: 0.9,
      shoulderSeamLength: 5.5,
      sideSeamLength: 7.5,
      backBodiceLength: 16.0,
      frontBodiceLength: 19.5,
      centerFrontLength: 15.5,
      bustDepth: 11.5,
      acrossChestWidth: 15.0,
      centerBackLength: 15.5,
      acrossBackWidthProvided: false,
      acrossBackWidth: 0,
      hasShoulderDart: false,
      hasSwaybackContour: false,
    },
  },
];

const TOL = 0.01; // in

function expectPointClose(
  actual: { x: number; y: number },
  expected: Pt,
  label: string,
) {
  expect(actual.x, `${label}.x`).toBeCloseTo(expected.x, 2);
  expect(actual.y, `${label}.y`).toBeCloseTo(expected.y, 2);
}

describe("bodice — numeric match against PatternLab reference", () => {
  for (const { name, m } of REFERENCE_SETS) {
    it(`front points match: ${name}`, () => {
      const shoulderIn = shoulderInputsFor(m);
      const erpM = toErpMeasurements(m, shoulderIn);
      const draft = calculateBodice(erpM, "front", {
        bodiceShoulderDart: m.hasShoulderDart,
        bodiceSwayback: m.hasSwaybackContour,
      });
      const ref = referenceFront(m);
      const front = draft.front!;

      expectPointClose(front.centreNeck, toEngine(ref.C), "centreNeck");
      expectPointClose(front.neckPoint, toEngine(ref.F), "neckPoint");
      expectPointClose(front.shoulderPoint, toEngine(ref.G), "shoulderPoint");
      expectPointClose(front.bustPoint, toEngine(ref.H), "bustPoint");
      expectPointClose(
        front.acrossChestPoint,
        toEngine(ref.I),
        "acrossChestPoint",
      );
      expectPointClose(front.underarm, toEngine(ref.K), "underarm");
      expectPointClose(front.dartLegBase, toEngine(ref.J1), "dartLegBase");
      expectPointClose(front.dartLegApex, toEngine(ref.P), "dartLegApex");
      expectPointClose(front.sideExtOuter, toEngine(ref.M), "sideExtOuter");
      expectPointClose(front.waistSide, toEngine(ref.N), "waistSide");
      expectPointClose(front.centreWaist, toEngine(ref.B), "centreWaist");
    });

    it(`back points match: ${name}`, () => {
      const shoulderIn = shoulderInputsFor(m);
      const erpM = toErpMeasurements(m, shoulderIn);
      const draft = calculateBodice(erpM, "back", {
        bodiceShoulderDart: m.hasShoulderDart,
        bodiceSwayback: m.hasSwaybackContour,
      });
      const ref = referenceBack(m);
      const back = draft.back!;

      expectPointClose(back.centreNeck, toEngine(ref.C), "centreNeck");
      expectPointClose(back.neckPoint, toEngine(ref.F), "neckPoint");
      expectPointClose(
        back.shoulderPoint,
        toEngine(m.hasShoulderDart ? ref.E1 : ref.E),
        "shoulderPoint",
      );
      expectPointClose(
        back.acrossBackPoint,
        toEngine(ref.R),
        "acrossBackPoint",
      );
      expectPointClose(back.underarm, toEngine(ref.O), "underarm");
      expectPointClose(back.waistSideTop, toEngine(ref.K), "waistSideTop");
      expectPointClose(back.sideSeamBase, toEngine(ref.H), "sideSeamBase");
      expectPointClose(back.waistDartLeg, toEngine(ref.J), "waistDartLeg");
      expectPointClose(back.waistDartFoot, toEngine(ref.G1), "waistDartFoot");
      expectPointClose(back.centreWaist, toEngine(ref.BActive), "centreWaist");

      if (m.hasShoulderDart) {
        expect(draft.shoulderDart).toBeDefined();
        expectPointClose(
          draft.shoulderDart!.apex,
          toEngine(ref.P),
          "shoulderDart.apex",
        );
        expectPointClose(
          draft.shoulderDart!.legStart,
          toEngine(ref.P1),
          "shoulderDart.legStart",
        );
        expectPointClose(
          draft.shoulderDart!.legEnd,
          toEngine(ref.P2),
          "shoulderDart.legEnd",
        );
      } else {
        expect(draft.shoulderDart).toBeUndefined();
      }
    });

    it(`side seam matches between front and back by construction: ${name}`, () => {
      const shoulderIn = shoulderInputsFor(m);
      const erpM = toErpMeasurements(m, shoulderIn);
      const front = calculateBodice(erpM, "front", {});
      const back = calculateBodice(erpM, "back", {});
      // Both panels read the same explicit `sideSeamLength` measurement.
      expect(front.resolved.sideSeamLength).toBeCloseTo(
        back.resolved.sideSeamLength,
        6,
      );
      expect(front.resolved.sideSeamLength).toBeCloseTo(m.sideSeamLength, 2);
    });
  }
});

describe("bodice — estimation fallbacks", () => {
  const minimal: Measurements = {
    chest: 36.22,
    waist: 27.56,
    shoulder: 4.72,
    height: 64.96,
  };

  it("estimates every new field and still drafts a closed block", () => {
    const front = bodiceFront(minimal);
    const back = bodiceBack(minimal);
    expect(front.missingMeasurements).toHaveLength(0);
    expect(back.missingMeasurements).toHaveLength(0);
    expect(front.paths[0]!.d.startsWith("M")).toBe(true);
    expect(front.paths[0]!.d.trim().endsWith("Z")).toBe(true);

    const estimatedFields = front.estimates.map((e) => e.field);
    for (const field of [
      "shoulderDrop",
      "bustDepth",
      "centerFrontLength",
      "acrossChestWidth",
    ] as const) {
      expect(estimatedFields, `expected ${field} to be estimated`).toContain(
        field,
      );
    }
  });

  it("estimated side seam still matches between front and back", () => {
    const front = calculateBodice(minimal, "front", {});
    const back = calculateBodice(minimal, "back", {});
    expect(front.resolved.sideSeamLength).toBeCloseTo(
      back.resolved.sideSeamLength,
      6,
    );
  });

  it("falls back to the standard neck width when the shoulder triangle is impossible", () => {
    // shoulderDrop larger than the shoulder seam makes shortSide() undefined
    // (NaN before the guard) — PatternLab's own documented fallback is 2.75in.
    const draft = calculateBodice(
      {
        chest: 36.22,
        waist: 27.56,
        shoulder: 4.72,
        shoulderDrop: 19.69,
        height: 64.96,
      },
      "front",
      {},
    );
    expect(draft.calc.neckWidth).toBeCloseTo(BODICE.neckWidthFallback, 6);
  });
});

describe("bodice — end-to-end block shape", () => {
  const m: Measurements = {
    chest: 35.43,
    waist: 27.95,
    shoulder: 15.55,
    neck: 14.17,
    height: 64.96,
    frontNeckToWaist: 16.54,
    backNeckToWaist: 15.75,
  };

  it("bodiceFront / bodiceBack return a drawable, non-degenerate block", () => {
    for (const block of [bodiceFront(m), bodiceBack(m)] as PatternBlock[]) {
      expect(block.missingMeasurements).toHaveLength(0);
      expect(block.viewBox.w).toBeGreaterThan(1);
      expect(block.viewBox.h).toBeGreaterThan(1);
      const outline = block.paths.find((p) => p.type === "outline")!;
      expect(outline.d.startsWith("M")).toBe(true);
      expect(outline.d.trim().endsWith("Z")).toBe(true);
      // Every panel uses cubic-Bézier curves for the neckline/armhole now.
      expect(outline.d).toContain("C ");
    }
  });

  it("draftBodice dispatches front/back correctly", () => {
    expect(draftBodice(m, "front").id).toBe("bodice-front");
    expect(draftBodice(m, "back").id).toBe("bodice-back");
  });

  it("reports a missing-measurement placeholder rather than throwing", () => {
    const block = bodiceFront({});
    expect(block.missingMeasurements.length).toBeGreaterThan(0);
    expect(block.paths).toHaveLength(0);
  });
});
