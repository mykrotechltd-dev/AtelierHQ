/**
 * Bodice geometry: turns a calculated draft into SVG paths and labels.
 *
 * This layer owns no drafting decisions. Every coordinate comes from the
 * calculator, so changing the drafting method never touches rendering, and
 * changing how a curve is drawn never moves a drafted point.
 *
 * The outline traversal and curve-handle formulas below are ported from
 * PatternLab's `src/components/patterns/FrontBodiceDashboard.tsx`
 * (`buildFrontPath`/`frontCurveHandles`, `buildBackPath`/`backCurveHandles`).
 * The handle formulas are expressed here as point-to-point differences and
 * `pointAtAngle` calls rather than the source's raw signed offsets — both
 * forms are numerically identical (verified point-for-point against the
 * source's own raw, Y-up formulas when this file was written), but
 * expressing them as differences between this engine's own named points
 * avoids re-deriving a sign convention by hand at every call site.
 */

import { BODICE } from "./constants.ts";
import { boundsOf, path } from "./geometry.ts";
import { angleBetween, distance, pointAtAngle } from "./points.ts";
import type { BodiceDraft } from "./bodice-calculator.ts";
import type { Point } from "./types.ts";
import {
  BLOCK_LABELS,
  type BlockType,
  type PatternBlock,
  type PatternLabel,
  type PatternPath,
} from "./types.ts";

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ── Front outline — ported from buildFrontPath / frontCurveHandles ───────────

function frontOutline(draft: BodiceDraft): string {
  const p = draft.front!;
  const c = BODICE.curve;

  const neckWidthPx = Math.abs(p.neckPoint.x - p.centreNeck.x);
  const neckDepth = Math.abs(p.neckPoint.y - p.centreNeck.y);
  const distGI = Math.abs(p.shoulderPoint.y - p.acrossChestPoint.y);
  const distIK = Math.abs(p.acrossChestPoint.y - p.underarm.y);
  const armscyeWidth = Math.abs(p.underarm.x - p.acrossChestPoint.x);

  // cRight, fLeft: neckline curve (C -> F). gRight, iLeft, iRight, kLeft:
  // armhole curve (G -> I -> K).
  const cRight: Point = { x: p.centreNeck.x + neckWidthPx * c.frontNeckRightFraction, y: p.centreNeck.y };
  const fLeft: Point = { x: p.neckPoint.x, y: p.neckPoint.y + neckDepth * c.frontNeckLeftFraction };
  const gRight = pointAtAngle(
    p.shoulderPoint,
    angleBetween(p.shoulderPoint, p.acrossChestPoint),
    distGI * c.frontArmholeUpperFraction
  );
  const iLeft: Point = { x: p.acrossChestPoint.x, y: p.acrossChestPoint.y - distGI * c.frontArmholeUpperFraction };
  const iRight: Point = { x: p.acrossChestPoint.x, y: p.acrossChestPoint.y + distIK * c.frontArmholeLowerFraction };
  const kLeft: Point = { x: p.underarm.x - armscyeWidth * c.frontUnderarmFraction, y: p.underarm.y };

  // Traversal order, ported verbatim from buildFrontPath: C -> F (curve) ->
  // G (line) -> I (curve) -> K (curve) -> N (line) -> P (line) -> H (line)
  // -> J1 (line) -> B (line) -> close. The bust dart is welded into the
  // cutting line as a V-notch (N -> P -> H -> J1), not drawn separately.
  return path()
    .moveToPoint(p.centreNeck)
    .cubicTo(cRight.x, cRight.y, fLeft.x, fLeft.y, p.neckPoint.x, p.neckPoint.y)
    .lineToPoint(p.shoulderPoint)
    .cubicTo(gRight.x, gRight.y, iLeft.x, iLeft.y, p.acrossChestPoint.x, p.acrossChestPoint.y)
    .cubicTo(iRight.x, iRight.y, kLeft.x, kLeft.y, p.underarm.x, p.underarm.y)
    .lineToPoint(p.waistSide)
    .lineToPoint(p.dartLegApex)
    .lineToPoint(p.bustPoint)
    .lineToPoint(p.dartLegBase)
    .lineToPoint(p.centreWaist)
    .close()
    .toString();
}

// ── Back outline — ported from buildBackPath / backCurveHandles ──────────────

function backOutline(draft: BodiceDraft): string {
  const p = draft.back!;
  const c = BODICE.curve;
  const dart = draft.shoulderDart as (BodiceDraft["shoulderDart"] & { throat?: Point }) | undefined;

  const distER = Math.abs(p.shoulderPoint.y - p.acrossBackPoint.y);
  const distRO = Math.abs(p.acrossBackPoint.y - p.underarm.y);
  const widthRO = Math.abs(p.underarm.x - p.acrossBackPoint.x);

  const cRight: Point = {
    x: p.centreNeck.x + (p.neckPoint.x - p.centreNeck.x) * c.backNeckFraction,
    y: p.centreNeck.y,
  };
  const rLeft: Point = { x: p.acrossBackPoint.x, y: p.acrossBackPoint.y - distER * c.backArmholeUpperFraction };
  const rRight: Point = { x: p.acrossBackPoint.x, y: p.acrossBackPoint.y + distRO * c.backArmholeLowerFraction };
  const e1Right = pointAtAngle(
    p.shoulderPoint,
    angleBetween(p.shoulderPoint, p.acrossBackPoint),
    distER * c.backArmholeUpperFraction
  );
  const oLeft: Point = { x: p.underarm.x + widthRO * c.backArmholeLowerFraction, y: p.underarm.y };

  // Traversal, ported verbatim from buildBackPath: C -> F (curve) -> [shoulder
  // dart legs P1 -> Q -> P2, when enabled] -> E1/shoulderPoint (line) -> R
  // (curve) -> O (curve) -> K -> H -> J -> G1 -> B (lines) -> close.
  const b = path().moveToPoint(p.centreNeck);
  b.cubicTo(cRight.x, cRight.y, p.neckPoint.x, p.neckPoint.y, p.neckPoint.x, p.neckPoint.y);

  if (dart && dart.intake > 0 && dart.throat) {
    b.lineToPoint(dart.legStart).lineToPoint(dart.throat).lineToPoint(dart.legEnd).lineToPoint(p.shoulderPoint);
  } else {
    b.lineToPoint(p.shoulderPoint);
  }

  b.cubicTo(e1Right.x, e1Right.y, rLeft.x, rLeft.y, p.acrossBackPoint.x, p.acrossBackPoint.y)
    .cubicTo(rRight.x, rRight.y, oLeft.x, oLeft.y, p.underarm.x, p.underarm.y)
    .lineToPoint(p.waistSideTop)
    .lineToPoint(p.sideSeamBase)
    .lineToPoint(p.waistDartLeg)
    .lineToPoint(p.waistDartFoot)
    .lineToPoint(p.centreWaist)
    .close();

  return b.toString();
}

/** Construction lines: the framework the draft was built on. */
function buildConstruction(draft: BodiceDraft): PatternPath[] {
  const out: PatternPath[] = [];
  const isFront = draft.panel === "front";
  const p = isFront ? draft.front! : draft.back!;
  const underarm = p.underarm;

  // Underarm/bust level, across from the centre line.
  out.push({
    d: path().moveTo(0, underarm.y).lineTo(underarm.x, underarm.y).toString(),
    type: "construction",
  });

  // Waist level.
  out.push({
    d: path().moveTo(0, p.centreWaist.y).lineTo(p.centreWaist.x, p.centreWaist.y).toString(),
    type: "construction",
  });

  if (isFront && draft.front) {
    const bp = draft.front.bustPoint;
    out.push({ d: path().moveTo(bp.x - 1, bp.y).lineTo(bp.x + 1, bp.y).toString(), type: "construction" });
    out.push({ d: path().moveTo(bp.x, bp.y - 1).lineTo(bp.x, bp.y + 1).toString(), type: "construction" });
  }

  return out;
}

/** Dart paths: the legs and apex, drawn so they can be traced onto fabric. */
function buildDarts(draft: BodiceDraft): PatternPath[] {
  const out: PatternPath[] = [];

  if (draft.bustDart && draft.bustDart.intake > 0) {
    const d = draft.bustDart;
    out.push({
      d: path().moveToPoint(d.legStart).lineToPoint(d.apex).lineToPoint(d.legEnd).toString(),
      type: "dart",
    });
  }

  if (draft.shoulderDart && draft.shoulderDart.intake > 0) {
    const d = draft.shoulderDart;
    out.push({
      d: path().moveToPoint(d.legStart).lineToPoint(d.apex).lineToPoint(d.legEnd).toString(),
      type: "dart",
    });
  }

  return out;
}

function buildLabels(draft: BodiceDraft): PatternLabel[] {
  const isFront = draft.panel === "front";
  const p = isFront ? draft.front! : draft.back!;
  const midX = p.underarm.x * 0.45;
  const len = p.centreWaist.y;

  const labels: PatternLabel[] = [
    {
      x: midX,
      y: len * 0.52,
      text: isFront ? "BODICE FRONT" : "BODICE BACK",
      anchor: "middle",
      fontSize: 4.5,
    },
    { x: 1, y: p.underarm.y - 1.2, text: "Bust line", anchor: "start", fontSize: 3 },
    {
      x: -0.5,
      y: len / 2,
      text: isFront ? "C F" : "C B  (fold)",
      anchor: "middle",
      fontSize: 3.5,
      rotate: -90,
    },
  ];

  if (isFront && draft.front) {
    labels.push({
      x: draft.front.bustPoint.x + 1.5,
      y: draft.front.bustPoint.y - 1.2,
      text: "BP",
      anchor: "start",
      fontSize: 3,
    });
  }

  return labels;
}

function buildNotes(draft: BodiceDraft): string[] {
  const c = draft.calc;
  const r = draft.resolved;
  const isFront = draft.panel === "front";

  const notes = [
    `Bodice length: ${(isFront ? r.frontBodiceLength : r.backBodiceLength).toFixed(1)} cm · Side seam: ${r.sideSeamLength.toFixed(1)} cm`,
    `Shoulder seam: ${r.shoulderLen.toFixed(1)} cm at ${r.shoulderDrop.toFixed(1)} cm drop · Neck width: ${c.neckWidth.toFixed(1)} cm`,
  ];

  if (isFront) {
    notes.push(`Armhole ease: ${c.armholeEase.toFixed(1)} cm (tiered by bust) · Bust depth: ${r.bustDepth.toFixed(1)} cm`);
  }

  if (draft.bustDart) {
    notes.push(`Bust dart: ${draft.bustDart.intake.toFixed(1)} cm intake, welded into the cutting line at the apex`);
  }
  if (draft.shoulderDart) {
    notes.push(`Shoulder dart: ${draft.shoulderDart.intake.toFixed(1)} cm intake for shoulder-blade shaping`);
  }

  notes.push("No seam allowance — add before cutting");
  notes.push("BASIC BLOCK — true up and verify fit before cutting fabric");
  return notes;
}

/** Assembles a calculated draft into a renderable block. */
export function buildBodiceBlock(draft: BodiceDraft): PatternBlock {
  const isFront = draft.panel === "front";
  const id: BlockType = isFront ? "bodice-front" : "bodice-back";
  const p = isFront ? draft.front! : draft.back!;

  const outline = isFront ? frontOutline(draft) : backOutline(draft);
  const paths: PatternPath[] = [
    { d: outline, type: "outline" },
    ...buildConstruction(draft),
    ...buildDarts(draft),
  ];

  // Grainline runs parallel to the centre line.
  const gx = p.underarm.x * BODICE.grainlinePositionRatio;
  const len = p.centreWaist.y;
  paths.push({
    d: path()
      .moveTo(gx, len * BODICE.grainlineInsetRatio)
      .lineTo(gx, len * (1 - BODICE.grainlineInsetRatio))
      .toString(),
    type: "grainline",
  });

  if (!isFront) {
    paths.push({ d: path().moveTo(0, 0).lineTo(0, len).toString(), type: "fold" });
  }

  const diagnostics = [
    ...draft.diagnostics,
    ...draft.estimates.map((e) => ({
      code: "MEASUREMENT_ESTIMATED" as const,
      severity: "info" as const,
      field: e.field,
      message: `${e.field} was not measured — estimated as ${e.value.toFixed(1)} cm from ${e.from}.`,
    })),
    {
      code: "NO_SEAM_ALLOWANCE" as const,
      severity: "info" as const,
      message: "No seam allowance is included. Add it before cutting.",
    },
    {
      code: "VERIFY_BEFORE_CUTTING" as const,
      severity: "warning" as const,
      message: "This is a basic block. True up the seams and check the fit on a toile before cutting fabric.",
    },
  ];

  if (!isFront) {
    diagnostics.push({
      code: "CUT_ON_FOLD" as const,
      severity: "info" as const,
      message: "Centre back is a fold line — cut on the fold, or add a seam for a zip.",
    });
  }

  return {
    id,
    name: BLOCK_LABELS[id],
    viewBox: boundsOf(paths.map((path) => path.d), 3),
    paths,
    labels: buildLabels(draft),
    notes: buildNotes(draft),
    diagnostics,
    calculations: { ...draft.calc } as unknown as Record<string, number>,
    estimates: draft.estimates,
    metadata: {
      garment: "bodice",
      panel: draft.panel,
      cutOnFold: !isFront,
      measurements: {
        chest: draft.resolved.bust,
        waist: draft.resolved.waist,
        shoulder: draft.resolved.shoulderLen,
      },
    },
    missingMeasurements: [],
  };
}

// Re-exported for callers that measure distances between the new named
// points (e.g. tests asserting side-seam length matches between panels).
export { distance };
