/**
 * Bodice draft calculator.
 *
 * Implements the point-by-point block method: every point is computed from a
 * measurement, never drawn freehand. Produces named points and drafting values
 * only — no SVG. Rendering is a separate layer, so the same draft can be drawn,
 * exported, graded, or asserted against reference values.
 *
 * Coordinate convention (per the method spec):
 *   origin (0,0) at the neck point on the centre line
 *   x increases toward the side seam
 *   y increases downward toward the waist
 *
 * Front and back are drafted as separate pieces, each with its own local origin.
 */

import { BODICE, BODY, EASE_EXTRA, DEFAULT_EASE } from "./constants.ts";
import { openDart, point, pointAtSlope, type BustDart, type DraftPoint } from "./points.ts";
import type {
  BlockOptions,
  Diagnostic,
  Estimate,
  Measurements,
  PanelSide,
} from "./types.ts";

// ── Result shape ──────────────────────────────────────────────────────────────

export type BodiceDraft = {
  panel: PanelSide;

  /** Measurements after estimation, i.e. what the draft actually used. */
  resolved: {
    bust: number;
    waist: number;
    neck: number;
    shoulderLen: number;
    backWidth: number;
    bodiceLength: number;
    bustPointSep: number;
    shoulderToBust: number;
  };

  /** Named drafting values, all cm. */
  calc: {
    easeBust: number;
    easeWaist: number;
    armholeDepth: number;
    /** Quarter bust including its share of ease — the side seam x. */
    bustQuarter: number;
    /** Quarter waist including its share of ease. */
    waistQuarter: number;
    neckWidth: number;
    neckDrop: number;
    shoulderSlopeDrop: number;
    /** Total suppression to remove between bust and waist level. */
    waistSuppression: number;
    sideSeamIntake: number;
    waistDartIntake: number;
    shoulderDartIntake: number;
    bustDartIntake: number;
  };

  points: {
    /** Neck point at the centre line. */
    centreNeck: DraftPoint;
    /** Waist at the centre line. */
    centreWaist: DraftPoint;
    /** Centre line at armhole depth level. */
    centreArmhole: DraftPoint;
    /** Neck point on the shoulder side. */
    neckPoint: DraftPoint;
    /** Shoulder tip. */
    shoulderPoint: DraftPoint;
    /** Across-back / across-chest point at armhole depth. */
    widthPoint: DraftPoint;
    /** Underarm, where the side seam meets armhole depth. */
    underarm: DraftPoint;
    /** Side seam at waist level. */
    waistSide: DraftPoint;
    /** Bust apex. Front only. */
    bustPoint?: DraftPoint;
  };

  /** Back shoulder dart, for shoulder-blade shaping. Back only. */
  shoulderDart?: BustDart;
  /** Side bust dart, rotated around the bust point. Front only. */
  bustDart?: BustDart;

  waistDart: {
    /** Centre of the dart on the waistline. */
    x: number;
    intake: number;
    /** Apex height above the waist. */
    height: number;
  };

  estimates: Estimate[];
  diagnostics: Diagnostic[];
};

// ── Calculator ────────────────────────────────────────────────────────────────

/**
 * Drafts one bodice panel.
 *
 * Callers must validate first: this assumes bust, waist and shoulder are
 * present and positive. Optional measurements are estimated, and every estimate
 * is recorded so the UI can disclose it.
 */
export function calculateBodice(
  m: Measurements,
  panel: PanelSide,
  opts: BlockOptions = {}
): BodiceDraft {
  const isFront = panel === "front";
  const estimates: Estimate[] = [];
  const diagnostics: Diagnostic[] = [];

  const bust = m.chest ?? 0;
  const waist = m.waist ?? 0;

  // ── Resolve measurements, estimating what was not taken ────────────────────

  const neck = resolve(m.neck, () => bust / BODY.neckFromChestDivisor, "neck", "chest ÷ 2.6", estimates);

  const backWidth = resolve(
    m.backWidth,
    () => bust / BODICE.backWidthDivisor + BODICE.backWidthOffset,
    "backWidth",
    "bust ÷ 6 + 5.5",
    estimates
  );

  // A shoulder recorded tip-to-tip across the back covers both shoulders plus
  // the neck; a single seam is the neck point to one tip. Detect and normalise.
  const shoulderRaw = m.shoulder ?? 0;
  const readAsCross = shoulderRaw >= 30;
  const shoulderLen = readAsCross ? shoulderRaw / 2 - neck / BODICE.backNeckWidthDivisor : shoulderRaw;
  diagnostics.push({
    code: readAsCross ? "SHOULDER_READ_AS_CROSS" : "SHOULDER_READ_AS_SEAM",
    severity: "info",
    field: "shoulder",
    message: readAsCross
      ? `Shoulder ${shoulderRaw} cm read as a tip-to-tip measurement, giving a ${shoulderLen.toFixed(1)} cm shoulder seam.`
      : `Shoulder ${shoulderRaw} cm read as a single shoulder seam.`,
  });

  // Bodice length: prefer the measured vertical, fall back to a height ratio.
  const bodiceLength = isFront
    ? resolveBodiceLength(
        m.frontNeckToWaist,
        m.height,
        BODY.frontNeckToWaistFromHeightRatio,
        BODY.fallbackBodiceLength.front,
        "frontNeckToWaist",
        estimates
      )
    : resolveBodiceLength(
        m.backNeckToWaist,
        m.height,
        BODY.backNeckToWaistFromHeightRatio,
        BODY.fallbackBodiceLength.back,
        "backNeckToWaist",
        estimates
      );

  const bustPointSep = resolve(
    m.bustPointSep,
    () => bust * BODICE.bustPointSepFromBustRatio,
    "bustPointSep",
    "bust × 0.2",
    estimates
  );

  const shoulderToBust = resolve(
    m.shoulderToBust,
    () => bust * BODICE.shoulderToBustFromBustRatio,
    "shoulderToBust",
    "bust × 0.28",
    estimates
  );

  // ── Ease ───────────────────────────────────────────────────────────────────

  const preset = opts.ease ?? DEFAULT_EASE;
  const extra = EASE_EXTRA[preset] ?? 0;
  if (EASE_EXTRA[preset] === undefined) {
    diagnostics.push({
      code: "EASE_UNRECOGNISED",
      severity: "warning",
      message: `Unrecognised ease "${String(preset)}" — drafted with standard ease.`,
    });
  }
  const easeBust = BODICE.easeBust + extra;
  const easeWaist = BODICE.easeWaist + extra;

  // ── Framework ──────────────────────────────────────────────────────────────

  const armholeDepth = bust / BODICE.armholeDepthDivisor / 2 + BODICE.armholeDepthOffset;
  const bustQuarter = bust / 4 + easeBust / 4;
  const waistQuarter = waist / 4 + easeWaist / 4;

  const neckWidth = isFront
    ? neck / BODICE.frontNeckWidthDivisor
    : neck / BODICE.backNeckWidthDivisor + BODICE.backNeckWidthOffset;
  const neckDrop = isFront
    ? neck / BODICE.frontNeckWidthDivisor + BODICE.frontNeckDropOffset
    : neckWidth * BODICE.backNeckDropRatio;

  // ── Points ─────────────────────────────────────────────────────────────────

  const centreNeck = point("centreNeck", isFront ? "Front neck point" : "Nape", 0, 0, "origin", []);

  const centreWaist = point(
    "centreWaist",
    isFront ? "CF waist" : "CB waist",
    0,
    bodiceLength,
    isFront ? "front neck to waist" : "nape to waist",
    [isFront ? "frontNeckToWaist" : "backNeckToWaist"]
  );

  const centreArmhole = point(
    "centreArmhole",
    "Armhole depth level",
    0,
    armholeDepth,
    "bust ÷ 8 + 5",
    ["chest"]
  );

  const neckPoint = point(
    "neckPoint",
    "Neck point",
    neckWidth,
    neckDrop,
    isFront ? "neck ÷ 5 across, neck ÷ 5 + 1 down" : "neck ÷ 5 + 0.5 across, ⅓ of that down",
    ["neck"]
  );

  // Shoulder tip: measured seam length at the average slope drop, solved by
  // Pythagoras rather than clamped to an arbitrary box.
  const shoulderSlopeDrop = BODICE.shoulderSlopeDrop;
  // The back shoulder is darted, so it is cut longer than the front by the dart
  // intake; the front seam is correspondingly shorter.
  const seamLength = isFront
    ? Math.max(shoulderLen - BODICE.backShoulderDartIntake, 1)
    : shoulderLen;
  const tip = pointAtSlope(neckPoint, seamLength, shoulderSlopeDrop);
  const shoulderPoint = point(
    "shoulderPoint",
    "Shoulder point",
    tip.x,
    tip.y,
    `neck point + √(${seamLength.toFixed(1)}² − ${shoulderSlopeDrop}²) across, ${shoulderSlopeDrop} down`,
    ["shoulder"]
  );

  const widthPoint = point(
    "widthPoint",
    isFront ? "Across chest" : "Across back",
    backWidth / 2,
    armholeDepth,
    isFront ? "across back ÷ 2 (chest is drafted to match)" : "across back ÷ 2",
    ["backWidth", "chest"]
  );

  const underarm = point(
    "underarm",
    "Underarm",
    bustQuarter,
    armholeDepth,
    "bust ÷ 4 + ease ÷ 4",
    ["chest"]
  );

  // ── Waist suppression ──────────────────────────────────────────────────────

  const waistSuppression = Math.max(bustQuarter - waistQuarter, 0);
  if (bustQuarter - waistQuarter < 0) {
    diagnostics.push({
      code: "NO_WAIST_SUPPRESSION",
      severity: "warning",
      message: `Waist quarter (${waistQuarter.toFixed(1)} cm) is wider than bust quarter (${bustQuarter.toFixed(1)} cm), so this panel has no waist shaping.`,
    });
  }

  // The side seam takes a fixed amount; the rest becomes the waist dart.
  const sideSeamIntake = Math.min(BODICE.sideSeamWaistIntake, waistSuppression);
  const waistDartIntake = Math.max(waistSuppression - sideSeamIntake, 0);

  const waistSide = point(
    "waistSide",
    "Side seam at waist",
    bustQuarter - sideSeamIntake,
    bodiceLength,
    `bust quarter − ${sideSeamIntake.toFixed(1)} cm side seam intake`,
    ["chest", "waist"]
  );

  // ── Darts ──────────────────────────────────────────────────────────────────

  const draft: BodiceDraft = {
    panel,
    resolved: { bust, waist, neck, shoulderLen, backWidth, bodiceLength, bustPointSep, shoulderToBust },
    calc: {
      easeBust,
      easeWaist,
      armholeDepth,
      bustQuarter,
      waistQuarter,
      neckWidth,
      neckDrop,
      shoulderSlopeDrop,
      waistSuppression,
      sideSeamIntake,
      waistDartIntake,
      shoulderDartIntake: 0,
      bustDartIntake: 0,
    },
    points: { centreNeck, centreWaist, centreArmhole, neckPoint, shoulderPoint, widthPoint, underarm, waistSide },
    waistDart: {
      x: 0,
      intake: waistDartIntake,
      height: 0,
    },
    estimates,
    diagnostics,
  };

  if (isFront) {
    // Bust apex: half the apex-to-apex separation from centre front, down by the
    // neck-point-to-bust-point measurement.
    const bp = point(
      "bustPoint",
      "Bust point",
      bustPointSep / 2,
      shoulderToBust,
      "bust point separation ÷ 2 across, shoulder to bust down",
      ["bustPointSep", "shoulderToBust"]
    );
    draft.points.bustPoint = bp;

    // Bust dart intake scales with the bust-to-waist differential, which stands
    // in for cup size when cup is not measured.
    const differential = Math.max(bust - waist, 0);
    const rawIntake = differential * BODICE.bustDartIntakeFromDifferentialRatio;
    const bustDartIntake = clamp(
      rawIntake,
      BODICE.bustDartIntakeRange.min,
      BODICE.bustDartIntakeRange.max
    );

    // Side bust dart: one leg runs from the underarm to the bust point, and the
    // dart opens by rotating that leg around the apex.
    draft.bustDart = openDart(bp, underarm, bustDartIntake, -1);
    draft.calc.bustDartIntake = draft.bustDart.intake;

    // The waist dart sits directly below the apex and stops short of it.
    draft.waistDart.x = bp.x;
    draft.waistDart.height = Math.max(bodiceLength - bp.y - BODICE.waistDartApexClearance, 2);
  } else {
    // Back shoulder dart, a third of the way along the shoulder from the neck.
    const t = BODICE.backShoulderDartPositionRatio;
    const dartBase = {
      x: neckPoint.x + (shoulderPoint.x - neckPoint.x) * t,
      y: neckPoint.y + (shoulderPoint.y - neckPoint.y) * t,
    };
    // Apex points down toward the shoulder blade.
    const apex = { x: dartBase.x, y: dartBase.y + BODICE.backShoulderDartLength };
    draft.shoulderDart = openDart(apex, dartBase, BODICE.backShoulderDartIntake, 1);
    draft.calc.shoulderDartIntake = draft.shoulderDart.intake;

    // Back waist dart sits about halfway out, apex short of shoulder-blade level.
    draft.waistDart.x = bustQuarter * BODICE.waistDartPositionRatio.back;
    draft.waistDart.height = Math.max(bodiceLength - armholeDepth - BODICE.waistDartApexClearance, 2);
  }

  return draft;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Uses a measured value, or derives one and records that it was estimated. */
function resolve(
  measured: number | undefined,
  derive: () => number,
  field: keyof Measurements,
  formula: string,
  estimates: Estimate[]
): number {
  if (measured !== undefined && Number.isFinite(measured) && measured > 0) return measured;
  const value = derive();
  estimates.push({ field, value, from: formula });
  return value;
}

/**
 * Bodice length, preferring a measured vertical over a height ratio.
 *
 * The distinction matters: a measured nape-to-waist is what makes a draft
 * bespoke, whereas a height ratio is a scaled standard size.
 */
function resolveBodiceLength(
  measured: number | undefined,
  height: number | undefined,
  ratio: number,
  fallback: number,
  field: keyof Measurements,
  estimates: Estimate[]
): number {
  if (measured !== undefined && Number.isFinite(measured) && measured > 0) return measured;
  if (height !== undefined && Number.isFinite(height) && height > 0) {
    const value = height * ratio;
    estimates.push({ field, value, from: `height × ${ratio}` });
    return value;
  }
  estimates.push({ field, value: fallback, from: "standard block length" });
  return fallback;
}
