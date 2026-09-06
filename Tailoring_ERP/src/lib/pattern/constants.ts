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

/** 1 inch in centimetres — every constant below is transcribed from
 *  PatternLab in inches (its native unit) and converted once, here. */
const IN = 2.54;

/**
 * Bodice drafting constants — the "Lety Antony" (front) / Helen
 * Joseph-Armstrong-derived (back) construction method, ported term-for-term
 * from PatternLab's `src/components/patterns/FrontBodiceDashboard.tsx`
 * (itself a port of the ExtendScript sources `NewFront-bodice.jsx` /
 * `NewBack_bodice.jsx`). Every value below is commented with the exact
 * PatternLab constant/expression it came from.
 */
export const BODICE = {
  /** `acrossChestEase = 0.25 * PT` (frontCurveHandles / point I). */
  acrossChestEase: 0.25 * IN,

  /** Armhole-ease tiers, `if (m.bust >= 50/40) ...` — thresholds converted
   *  from the source's raw inch bust circumference to cm, like everything
   *  else here, so the calculator can work in cm throughout. */
  armholeEaseTiers: [
    { minBust: 50 * IN, ease: 2.5 * IN },
    { minBust: 40 * IN, ease: 2.0 * IN },
  ],
  armholeEaseDefault: 1.5 * IN,
  /** `armholeDepth = (bust / 6 + armholeEase) * PT`. */
  armholeDepthDivisor: 6,

  /** `neckWidth = shoulderWidth/2 - shortSide(shoulderSeamLength, shoulderDrop)`,
   *  falling back to this when the triangle is invalid. */
  neckWidthFallback: 2.75 * IN,

  /** Dart placement on the waistline: `bustSpan/2 - 0.5` (both blocks). */
  dartPlacementOffset: 0.5 * IN,
  /** Front dart's first leg (J1) drop below J: `0.125 * PT`. */
  frontDartLegDrop: 0.125 * IN,

  /** Front side-extension tiers from `deltaL = frontBodiceLength - backBodiceLength`. */
  sideExtensionTiers: [
    { minDeltaL: 3.0 * IN, extension: 1.5 * IN },
    { minDeltaL: 1.0 * IN, extension: 1.25 * IN },
  ],
  sideExtensionDefault: 0,

  /** Back shoulder dart: `E1 = pointAtAngle(E, angleFE, 0.5*PT)`,
   *  `P1/P2 = pointAtAngle(P, angleFE, ∓0.25*PT)`. */
  backShoulderDartOffset: 0.5 * IN,
  backShoulderDartHalfWidth: 0.25 * IN,
  /** `qDistance = sideSeamLength/3 + 1.0*PT`. */
  backShoulderDartQOffset: 1.0 * IN,

  /** Swayback contour: `B1 = {x: B.x + 0.75*PT, y: B.y}`. */
  swaybackOffset: 0.75 * IN,

  /** Back waist dart width, both branches: `H = G ± 1.0*PT`. */
  backWaistDartWidth: 1.0 * IN,
  /** Back waist-side offset when swayback is on: `waist/4 + 1.0*PT`. */
  backWaistSideSwaybackOffset: 1.0 * IN,

  /** Across-back half width: provided branch adds this ease; fallback
   *  branch (`shoulderWidth/2 - 0.25*PT`) subtracts it. */
  acrossBackEase: 0.25 * IN,

  /** Curve-handle fractions — front (`frontCurveHandles`) and back
   *  (`backCurveHandles`), each a fraction of the distance/width named. */
  curve: {
    frontNeckRightFraction: 0.45, // cRight: neckWidthPx * 0.45
    frontNeckLeftFraction: 0.35, // fLeft: neckDepth * 0.35
    frontArmholeUpperFraction: 0.3, // gRight, iLeft: distGI * 0.3
    frontArmholeLowerFraction: 0.35, // iRight: distIK * 0.35
    frontUnderarmFraction: 0.35, // kLeft: armscyeWidth * 0.35
    backNeckFraction: 0.4, // cRight: (F.x - C.x) * 0.4
    backArmholeUpperFraction: 0.3, // rLeft, e1Right: distER * 0.3
    backArmholeLowerFraction: 0.35, // rRight, oLeft: distRO / widthRO * 0.35
  },

  grainlinePositionRatio: 0.5,
  grainlineInsetRatio: 0.2,

  // ── Estimation fallbacks for the new method's measurements, used only when
  // a tailor has not taken them. Not part of PatternLab itself (its dashboard
  // just ships static per-field defaults) — these ratios are derived from
  // PatternLab's own sample measurement set (bust 42in) so an estimated
  // draft for a similarly-proportioned body lands close to that reference,
  // following ERP's existing convention of estimating from a proportion
  // rather than a fixed constant (see bodice-calculator.ts's `resolve()`).
  /** `shoulderDrop` ≈ 0.75in for a 15in `shoulderWidth` sample. */
  shoulderDropFromShoulderRatio: 0.75 / 15,
  /** `bustDepth` ≈ 10.5in for a 42in `bust` sample. */
  bustDepthFromBustRatio: 10.5 / 42,
  /** Carried over from the previous bodice method — `bustSpan`
   *  (PatternLab's own name for `bustPointSep`) has no equivalent in either
   *  ExtendScript source's own defaults, so this ratio (unchanged from the
   *  engine's prior bodice calculator) is still the fallback when neither
   *  `bustPointSep` nor a size chart supplies it. */
  bustPointSepFromBustRatio: 0.2,
  /** Source's own comment on `centerBackLength`: "should be
   *  backBodiceLength - 0.5" — used verbatim as the fallback. */
  centerBackLengthOffset: 0.5 * IN,
  /** No equivalent front comment in the source; offset implied by its
   *  sample defaults (frontBodiceLength 18in, centerFrontLength 14.5in). */
  centerFrontLengthOffset: 3.5 * IN,
  /** `acrossChestWidth` ≈ 13.5in for a 42in `bust` sample. */
  acrossChestWidthFromBustRatio: 13.5 / 42,
  /** `sideSeamLength` ≈ 6.5in for a 15in `backBodiceLength` sample. Computed
   *  from the back panel's length regardless of which panel is drafting, so
   *  an estimated side seam still matches between front and back — the same
   *  "match by construction" guarantee the source gets for free from sharing
   *  one form. */
  sideSeamLengthFromBackBodiceLengthRatio: 6.5 / 15,
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
