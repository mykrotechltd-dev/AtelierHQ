/**
 * Drafting constants.
 *
 * Every number the drafting formulas use lives here, named and grouped, so the
 * method is auditable and adjustable in one place. A tailor's house formula can
 * differ from these; changing a value here changes it everywhere consistently.
 *
 * All values are centimetres unless the name says `Ratio` or `Factor`.
 */

import type { EasePreset, Measurements, UKSize } from "./types.ts";

// ── Ease ──────────────────────────────────────────────────────────────────────

export const EASE_PRESETS: readonly EasePreset[] = ["fitted", "standard", "relaxed"] as const;

export const EASE_LABELS: Record<EasePreset, string> = {
  fitted: "Fitted",
  standard: "Standard",
  relaxed: "Relaxed",
};

/**
 * Extra ease (cm) added to the full circumference on top of the base ease
 * already built into each block's formula. Quarter-panel drafts apply a
 * quarter of this.
 */
export const EASE_EXTRA: Record<EasePreset, number> = {
  fitted: -2,
  standard: 0,
  relaxed: 4,
};

export const DEFAULT_EASE: EasePreset = "standard";

// ── Shared body proportions ───────────────────────────────────────────────────

export const BODY = {
  /** Waist-to-hip drop when `waistToHip` is not measured. */
  waistToHip: 20,
  /** Neck estimated from chest when not measured: chest ÷ this. */
  neckFromChestDivisor: 2.6,
  /** Thigh estimated from hips when not measured: hips × this. */
  thighFromHipsFactor: 0.62,
  /** Nape-to-waist estimated from height: height × this. */
  backNeckToWaistFromHeightRatio: 0.247,
  /** Front-neck-to-waist estimated from height: height × this. */
  frontNeckToWaistFromHeightRatio: 0.245,
  /** Fallback bodice lengths when neither measurement nor height is known. */
  fallbackBodiceLength: { front: 41, back: 41.5 },
} as const;

// ── Plausible measurement ranges ──────────────────────────────────────────────

/**
 * Soft limits used for warnings, not rejection. A measurement outside these is
 * flagged for review but still drafted — real bodies fall outside standard
 * charts and the tailor is the authority, not the software.
 */
export const PLAUSIBLE_RANGE: Partial<Record<keyof Measurements, { min: number; max: number }>> = {
  chest: { min: 50, max: 200 },
  waist: { min: 40, max: 200 },
  hips: { min: 50, max: 220 },
  neck: { min: 25, max: 60 },
  height: { min: 120, max: 220 },
  sleeveLength: { min: 30, max: 90 },
  inseam: { min: 40, max: 110 },
  thigh: { min: 30, max: 110 },
};

/**
 * A shoulder measurement can be recorded two ways. Values at or above this
 * threshold are read as cross-shoulder (tip to tip across the back) and halved;
 * below it, as a single neck-point-to-tip seam.
 */
export const SHOULDER_CROSS_THRESHOLD = 30;

export const SHOULDER_SEAM_RANGE = { min: 4, max: 25 } as const;

/** Minimum gap kept between the shoulder tip and the side seam. */
export const SHOULDER_TIP_CLEARANCE = 2.5;

// ── Skirt block ───────────────────────────────────────────────────────────────

export const SKIRT = {
  defaultLength: 60,
  waistEase: { front: 1, back: 0.5 },
  hipEase: 1.5,
  /** Share of waist-to-hip suppression taken by the dart (rest goes to side seam). */
  dartShareOfIntake: 0.5,
  dartPositionRatio: { front: 0.42, back: 0.52 },
  dartDepth: { front: 10, back: 13 },
  grainlinePositionRatio: 0.63,
  grainlineInsetRatio: 0.15,
} as const;

// ── Bodice block ──────────────────────────────────────────────────────────────

/**
 * Bodice drafting constants, following the point-by-point block method.
 *
 * This is a close-fitting block (sloper): the foundation other styles are
 * drafted from, so ease is minimal and deliberately distributed.
 */
export const BODICE = {
  /**
   * Total bust ease for a close-fitting block (cm). A quarter is added to each
   * quarter-panel at the side seam.
   */
  easeBust: 5,
  /** Total waist ease (cm), distributed the same way. */
  easeWaist: 2.5,

  /** Armhole (scye) depth = bust ÷ divisor + offset. Tune the offset 4–6 cm. */
  armholeDepthDivisor: 4,
  armholeDepthOffset: 5,

  /** Across-back estimate when not measured: bust ÷ divisor + offset. */
  backWidthDivisor: 6,
  backWidthOffset: 5.5,

  /** Back neck width = neck ÷ divisor + offset; drop is a third of the width. */
  backNeckWidthDivisor: 5,
  backNeckWidthOffset: 0.5,
  backNeckDropRatio: 1 / 3,

  /** Front neck width = neck ÷ divisor; front drops lower than the back. */
  frontNeckWidthDivisor: 5,
  frontNeckDropOffset: 1,

  /** Vertical drop from neck point to shoulder point, for average slope. */
  shoulderSlopeDrop: 4.5,

  /** Back shoulder dart for shoulder-blade shaping. */
  backShoulderDartIntake: 1.2,
  /** Position along the shoulder line, from the neck point. */
  backShoulderDartPositionRatio: 1 / 3,
  backShoulderDartLength: 8,

  /** Of the total waist suppression, the side seam takes this much (cm). */
  sideSeamWaistIntake: 1.5,
  /** Waist dart apex stops this far short of bust / shoulder-blade level. */
  waistDartApexClearance: 5,
  waistDartPositionRatio: { front: 0.5, back: 0.5 },

  /** Bust point estimates, used when not measured. */
  bustPointSepFromBustRatio: 0.2,
  shoulderToBustFromBustRatio: 0.28,

  /**
   * Bust dart intake as a share of the bust-to-waist differential. A larger
   * differential implies a fuller cup and so a larger dart.
   */
  bustDartIntakeFromDifferentialRatio: 0.42,
  bustDartIntakeRange: { min: 4, max: 14 },

  /** Armhole curve control-point offsets, as fractions of the curve's box. */
  armholeCurve: {
    /** Back-width point pulled slightly inward. */
    upperInsetFraction: 0.12,
    upperHeightFraction: 0.42,
    /** Underarm approach pulled slightly outward. */
    lowerOutsetFraction: 0.46,
  },

  grainlinePositionRatio: 0.5,
  grainlineInsetRatio: 0.2,
} as const;

/**
 * Cubic Bézier control-point placement for the armhole scoop, expressed as
 * fractions of the box between the shoulder tip and the underarm.
 *
 * The curve leaves the shoulder tip almost vertically (small x offset, large y),
 * hollows inward, then arrives flat at the underarm. Because every fraction is
 * ≤ 1, the control points can never fall outside that box, so the armhole
 * cannot bulge past the side seam.
 */
export const ARMHOLE_CURVE = {
  cp1xFraction: 0.08,
  cp1yFraction: 0.44,
  cp2xFraction: 0.46,
} as const;

// ── Dress block ───────────────────────────────────────────────────────────────

export const DRESS = {
  defaultSkirtLength: 70,
  hipEase: 1.5,
  /** A-line flare added at the hem beyond the hip width. */
  hemFlare: 2.5,
  /** Waist-to-hip side seam bow. */
  hipSeamBow: 0.5,
  hipSeamBowHeightRatio: 0.55,
  /** The dress dart is a diamond: this far above and below the waist. */
  dartHeightAboveWaist: { front: 8, back: 10 },
  dartDepthBelowWaist: 13,
  grainlineTopRatio: 0.25,
  /** Grainline stops this far short of the hem. */
  grainlineHemClearance: 5,
} as const;

// ── Trouser block ─────────────────────────────────────────────────────────────

export const TROUSER = {
  hipEase: 2.5,
  waistEase: 1,
  /** Crotch depth = hips ÷ divisor + offset. */
  crotchDepthDivisor: 8,
  crotchDepthOffset: 3,
  /** Front crotch fork extension = hips ÷ this. */
  crotchExtensionDivisor: 16,
  thighEase: 2,
  dartShareOfIntake: 0.5,
  dartPositionRatio: 0.35,
  dartDepth: 9,
  crotchCurveControlRatio: { x: 0.6, y: 0.5 },
  kneeFromCrotchRatio: 0.5,
  grainlinePositionRatio: 0.45,
  grainlineInsetRatio: 0.15,
} as const;

// ── Sleeve block ──────────────────────────────────────────────────────────────

export const SLEEVE = {
  /** Armhole depth of the matching bodice, averaged front/back. */
  armholeDepthDivisor: 8,
  armholeDepthOffset: 7.25,
  /** Sleeve head height as a fraction of armhole depth. */
  headHeightRatio: 0.78,
  /** Bicep = chest × factor + ease. */
  bicepChestFactor: 0.32,
  bicepEase: 6,
  bicepEasePerPreset: 0.5,
  /** Wrist is the larger of bicep × this, or the chest-derived width. */
  wristBicepFloorRatio: 0.55,
  wristChestFactor: 0.17,
  wristEase: 4,
  wristEasePerPreset: 0.3,
  elbowFromHeadRatio: 0.52,
  notchHeightRatio: 0.55,
  notchLength: 1.5,
  /** Sleeve head curve control points, as fractions of width/height. */
  head: {
    frontApexX: 0.22,
    frontApexY: 0.22,
    backApexX: 0.8,
    backApexY: 0.25,
    frontLowerCpX: 0.06,
    frontLowerCpY: 0.45,
    frontUpperCpX: 0.36,
    frontUpperCpY: 0.01,
    backUpperCpX: 0.68,
    backUpperCpY: 0.02,
    backLowerCpX: 0.94,
    backLowerCpY: 0.52,
  },
  grainlineTopRatio: 0.2,
  grainlineBottomRatio: 0.82,
} as const;

// ── Rendering ─────────────────────────────────────────────────────────────────

export const RENDER = {
  /** Blank margin added around every block's bounding box. */
  viewBoxPadding: 3,
  /** Segments used to flatten a Bézier when computing bounds. */
  flattenSteps: 24,
} as const;

// ── Standard UK sizes ─────────────────────────────────────────────────────────

export const UK_SIZES: readonly UKSize[] = [
  "6", "8", "10", "12", "14", "16", "18", "20", "22",
] as const;

/** Standard body measurements (cm) per UK size. */
export const STANDARD_SIZES: Record<UKSize, Measurements> = {
  "6":  { chest: 80,  waist: 61, hips: 86,  shoulder: 38,   sleeveLength: 59,   inseam: 78, neck: 34, thigh: 52, height: 162 },
  "8":  { chest: 83,  waist: 64, hips: 89,  shoulder: 38.5, sleeveLength: 59,   inseam: 79, neck: 35, thigh: 54, height: 163 },
  "10": { chest: 86,  waist: 67, hips: 92,  shoulder: 39,   sleeveLength: 59.5, inseam: 79, neck: 36, thigh: 56, height: 164 },
  "12": { chest: 90,  waist: 71, hips: 96,  shoulder: 39.5, sleeveLength: 60,   inseam: 79, neck: 37, thigh: 58, height: 165 },
  "14": { chest: 95,  waist: 76, hips: 101, shoulder: 40,   sleeveLength: 60.5, inseam: 79, neck: 38, thigh: 61, height: 166 },
  "16": { chest: 100, waist: 81, hips: 106, shoulder: 41,   sleeveLength: 61,   inseam: 79, neck: 39, thigh: 64, height: 167 },
  "18": { chest: 106, waist: 87, hips: 112, shoulder: 42,   sleeveLength: 61.5, inseam: 79, neck: 40, thigh: 68, height: 167 },
  "20": { chest: 112, waist: 93, hips: 118, shoulder: 43,   sleeveLength: 62,   inseam: 79, neck: 41, thigh: 72, height: 168 },
  "22": { chest: 118, waist: 99, hips: 124, shoulder: 44,   sleeveLength: 62,   inseam: 79, neck: 42, thigh: 76, height: 168 },
};
