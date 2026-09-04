/**
 * Bodice geometry: turns a calculated draft into SVG paths and labels.
 *
 * This layer owns no drafting decisions. Every coordinate comes from the
 * calculator, so changing the drafting method never touches rendering, and
 * changing how a curve is drawn never moves a drafted point.
 */

import { BODICE, RENDER } from "./constants.ts";
import { boundsOf, path } from "./geometry.ts";
import type { BodiceDraft } from "./bodice-calculator.ts";
import type { Point } from "./types.ts";
import {
  BLOCK_LABELS,
  type BlockType,
  type PatternBlock,
  type PatternLabel,
  type PatternPath,
} from "./types.ts";

/**
 * Armhole as a cubic Bézier from the shoulder tip, past the across-back point,
 * into the underarm.
 *
 * The control points are placed as fractions of the box between the shoulder tip
 * and the underarm, so they can never fall outside it. That is what keeps the
 * armhole scooping inward instead of bulging past the side seam.
 */
function armholeSegment(shoulder: Point, widthPoint: Point, underarm: Point): string {
  const w = Math.max(underarm.x - shoulder.x, 0.1);
  const h = Math.max(underarm.y - shoulder.y, 0.1);
  const c = BODICE.armholeCurve;

  // First control point pulls the curve down off the shoulder and slightly in
  // toward the across-back point, keeping the upper armhole near-vertical.
  const cp1x = shoulder.x + w * c.upperInsetFraction;
  const cp1y = shoulder.y + h * c.upperHeightFraction;
  // Second control point sits at underarm level, pulled outward so the curve
  // arrives flat rather than at an angle.
  const cp2x = shoulder.x + w * c.lowerOutsetFraction;
  const cp2y = underarm.y;

  return `C ${round(cp1x)} ${round(cp1y)} ${round(cp2x)} ${round(cp2y)} ${round(underarm.x)} ${round(underarm.y)}`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Builds the closed outline, routing around the bust dart on the front. */
function buildOutline(draft: BodiceDraft): string {
  const p = draft.points;
  const b = path();

  // Centre line up from waist, then the neckline curve out to the neck point.
  b.moveToPoint(p.centreWaist).lineToPoint(p.centreNeck);

  if (draft.panel === "front") {
    // Front neckline scoops: control at the corner gives a rounded curve.
    b.quadTo(p.centreNeck.x, p.centreNeck.y, p.neckPoint.x, p.neckPoint.y);
  } else {
    // The back neck is nearly straight, with a shallow curve near centre back.
    b.quadTo(p.neckPoint.x * 0.5, p.centreNeck.y, p.neckPoint.x, p.neckPoint.y);
  }

  // Shoulder seam, split by the shoulder dart on the back.
  if (draft.panel === "back" && draft.shoulderDart && draft.shoulderDart.intake > 0) {
    const d = draft.shoulderDart;
    b.lineToPoint(d.legStart).lineToPoint(d.apex).lineToPoint(d.legEnd).lineToPoint(p.shoulderPoint);
  } else {
    b.lineToPoint(p.shoulderPoint);
  }

  // Armhole down to the underarm.
  b.append(armholeSegment(p.shoulderPoint, p.widthPoint, p.underarm));

  // Front: the side bust dart interrupts the side seam at the underarm.
  if (draft.panel === "front" && draft.bustDart && draft.bustDart.intake > 0) {
    const d = draft.bustDart;
    b.lineToPoint(d.apex).lineToPoint(d.legEnd);
  }

  // Side seam into the waist, then back along the waistline to the centre.
  b.lineToPoint(p.waistSide).lineToPoint(p.centreWaist).close();

  return b.toString();
}

/** Construction lines: the framework the draft was built on. */
function buildConstruction(draft: BodiceDraft): PatternPath[] {
  const p = draft.points;
  const out: PatternPath[] = [];

  // Bust / armhole depth level.
  out.push({
    d: path().moveTo(0, p.centreArmhole.y).lineTo(p.underarm.x, p.underarm.y).toString(),
    type: "construction",
  });

  // Waist level.
  out.push({
    d: path().moveTo(0, p.centreWaist.y).lineTo(p.waistSide.x, p.waistSide.y).toString(),
    type: "construction",
  });

  // Across back / across chest vertical, showing where the armhole is shaped.
  out.push({
    d: path().moveTo(p.widthPoint.x, 0).lineTo(p.widthPoint.x, p.widthPoint.y).toString(),
    type: "construction",
  });

  if (p.bustPoint) {
    // Bust point cross-hair, the pivot for all front dart manipulation.
    const bp = p.bustPoint;
    out.push({
      d: path().moveTo(bp.x - 1, bp.y).lineTo(bp.x + 1, bp.y).toString(),
      type: "construction",
    });
    out.push({
      d: path().moveTo(bp.x, bp.y - 1).lineTo(bp.x, bp.y + 1).toString(),
      type: "construction",
    });
  }

  return out;
}

/** Dart paths: the legs and apex, drawn so they can be traced onto fabric. */
function buildDarts(draft: BodiceDraft): PatternPath[] {
  const out: PatternPath[] = [];
  const { waistDart } = draft;

  // Waist dart: legs from the waistline up to the apex.
  if (waistDart.intake > 0 && waistDart.height > 0) {
    const waistY = draft.points.centreWaist.y;
    const half = waistDart.intake / 2;
    out.push({
      d: path()
        .moveTo(waistDart.x - half, waistY)
        .lineTo(waistDart.x, waistY - waistDart.height)
        .lineTo(waistDart.x + half, waistY)
        .toString(),
      type: "dart",
    });
  }

  // Bust dart legs, radiating from the apex.
  if (draft.bustDart && draft.bustDart.intake > 0) {
    const d = draft.bustDart;
    out.push({
      d: path().moveToPoint(d.legStart).lineToPoint(d.apex).lineToPoint(d.legEnd).toString(),
      type: "dart",
    });
  }

  // Shoulder dart legs.
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
  const p = draft.points;
  const isFront = draft.panel === "front";
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
    { x: 1, y: p.centreArmhole.y - 1.2, text: "Bust line", anchor: "start", fontSize: 3 },
    {
      x: -0.5,
      y: len / 2,
      text: isFront ? "C F" : "C B  (fold)",
      anchor: "middle",
      fontSize: 3.5,
      rotate: -90,
    },
  ];

  if (p.bustPoint) {
    labels.push({
      x: p.bustPoint.x + 1.5,
      y: p.bustPoint.y - 1.2,
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
  const notes = [
    `Armhole depth: ${c.armholeDepth.toFixed(1)} cm · Bodice length: ${r.bodiceLength.toFixed(1)} cm`,
    `Bust quarter: ${c.bustQuarter.toFixed(1)} cm · Waist quarter: ${c.waistQuarter.toFixed(1)} cm`,
    `Ease: ${c.easeBust.toFixed(1)} cm bust, ${c.easeWaist.toFixed(1)} cm waist (total)`,
    `Shoulder seam: ${r.shoulderLen.toFixed(1)} cm at ${c.shoulderSlopeDrop} cm slope`,
    `Waist suppression: ${c.waistSuppression.toFixed(1)} cm — ${c.sideSeamIntake.toFixed(1)} cm at the side seam, ${c.waistDartIntake.toFixed(1)} cm in the dart`,
  ];

  if (draft.bustDart) {
    notes.push(
      `Bust dart: ${draft.bustDart.intake.toFixed(1)} cm intake, rotated ${((draft.bustDart.angle * 180) / Math.PI).toFixed(1)}° around the bust point`
    );
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

  const outline = buildOutline(draft);
  const paths: PatternPath[] = [
    { d: outline, type: "outline" },
    ...buildConstruction(draft),
    ...buildDarts(draft),
  ];

  // Grainline runs parallel to the centre line.
  const gx = draft.points.underarm.x * BODICE.grainlinePositionRatio;
  const len = draft.points.centreWaist.y;
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
    // Bounds measured from the geometry actually drawn, so nothing clips.
    viewBox: boundsOf(paths.map((p) => p.d), RENDER.viewBoxPadding),
    paths,
    labels: buildLabels(draft),
    notes: buildNotes(draft),
    diagnostics,
    calculations: { ...draft.calc },
    estimates: draft.estimates,
    metadata: {
      garment: "bodice",
      panel: draft.panel,
      cutOnFold: !isFront,
      measurements: {
        chest: draft.resolved.bust,
        waist: draft.resolved.waist,
        neck: draft.resolved.neck,
        shoulder: draft.resolved.shoulderLen,
      },
    },
    missingMeasurements: [],
  };
}
