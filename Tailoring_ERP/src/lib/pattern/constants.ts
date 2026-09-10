/**
 * Drafting constants.
 *
 * Every number the drafting formulas use lives here, named and grouped, so the
 * method is auditable and adjustable in one place. A tailor's house formula can
 * differ from these; changing a value here changes it everywhere consistently.
 *
 * All values are inches unless the name says `Ratio` or `Factor`. Every
 * length below is written as `originalCmValue * CM` rather than a bare inch
 * literal — the engine's previous unit was centimetres, and writing it this
 * way keeps the original cm value visible/auditable right next to its
 * conversion instead of silently losing it to a rounded inch guess.
 */

import type { EasePreset, Measurements, UKSize } from "./types.ts";

/** 1 centimetre in inches. */
const CM = 1 / 2.54;

// ── Ease ──────────────────────────────────────────────────────────────────────

export const EASE_PRESETS: readonly EasePreset[] = [
  "fitted",
  "standard",
  "relaxed",
] as const;

export const EASE_LABELS: Record<EasePreset, string> = {
  fitted: "Fitted",
  standard: "Standard",
  relaxed: "Relaxed",
};

/**
 * Extra ease added to the full circumference on top of the base ease already
 * built into each block's formula. Quarter-panel drafts apply a quarter of
 * this.
 */
export const EASE_EXTRA: Record<EasePreset, number> = {
  fitted: -2 * CM,
  standard: 0,
  relaxed: 4 * CM,
};

export const DEFAULT_EASE: EasePreset = "standard";

// ── Shared body proportions ───────────────────────────────────────────────────

export const BODY = {
  /** Waist-to-hip drop when `waistToHip` is not measured. */
  waistToHip: 20 * CM,
  /** Neck estimated from chest when not measured: chest ÷ this. */
  neckFromChestDivisor: 2.6,
  /** Thigh estimated from hips when not measured: hips × this. */
  thighFromHipsFactor: 0.62,
  /** Nape-to-waist estimated from height: height × this. */
  backNeckToWaistFromHeightRatio: 0.247,
  /** Front-neck-to-waist estimated from height: height × this. */
  frontNeckToWaistFromHeightRatio: 0.245,
  /** Fallback bodice lengths when neither measurement nor height is known. */
  fallbackBodiceLength: { front: 41 * CM, back: 41.5 * CM },
} as const;

// ── Plausible measurement ranges ──────────────────────────────────────────────

/**
 * Soft limits used for warnings, not rejection. A measurement outside these is
 * flagged for review but still drafted — real bodies fall outside standard
 * charts, so the tailor is the authority, not the software.
 */
export const PLAUSIBLE_RANGE: Partial<
  Record<keyof Measurements, { min: number; max: number }>
> = {
  chest: { min: 50 * CM, max: 200 * CM },
  waist: { min: 40 * CM, max: 200 * CM },
  hips: { min: 50 * CM, max: 220 * CM },
  neck: { min: 25 * CM, max: 60 * CM },
  height: { min: 120 * CM, max: 220 * CM },
  sleeveLength: { min: 30 * CM, max: 90 * CM },
  inseam: { min: 40 * CM, max: 110 * CM },
  thigh: { min: 30 * CM, max: 110 * CM },
};

/**
 * A shoulder measurement can be recorded two ways. Values at or above this
 * threshold are read as cross-shoulder (tip to tip across the back) and halved;
 * below it, as a single neck-point-to-tip seam.
 */
export const SHOULDER_CROSS_THRESHOLD = 30 * CM;

export const SHOULDER_SEAM_RANGE = { min: 4 * CM, max: 25 * CM } as const;

/** Minimum gap kept between the shoulder tip and the side seam. */
export const SHOULDER_TIP_CLEARANCE = 2.5 * CM;

// ── Skirt block ───────────────────────────────────────────────────────────────

export const SKIRT = {
  defaultLength: 60 * CM,
  waistEase: { front: 1 * CM, back: 0.5 * CM },
  hipEase: 1.5 * CM,
  /** Share of waist-to-hip suppression taken by the dart (rest goes to side seam). */
  dartShareOfIntake: 0.5,
  dartPositionRatio: { front: 0.42, back: 0.52 },
  dartDepth: { front: 10 * CM, back: 13 * CM },
  grainlinePositionRatio: 0.63,
  grainlineInsetRatio: 0.15,
} as const;

// ── Bodice block ──────────────────────────────────────────────────────────────

/**
 * Bodice drafting constants — the "Lety Antony" (front) / Helen
 * Joseph-Armstrong-derived (back) construction method, ported term-for-term
 * from PatternLab's `src/components/patterns/FrontBodiceDashboard.tsx`
 * (itself a port of the ExtendScript sources `NewFront-bodice.jsx` /
 * `NewBack_bodice.jsx`). Every value below is commented with the exact
 * PatternLab constant/expression it came from. PatternLab's own source is
 * already in inches, so — now that this engine's native unit is inches too —
 * these are direct literals with no conversion factor at all.
 */
export const BODICE = {
  /** `acrossChestEase = 0.25 * PT` (frontCurveHandles / point I). */
  acrossChestEase: 0.25,

  /** Armhole-ease tiers, `if (m.bust >= 50/40) ...`. */
  armholeEaseTiers: [
    { minBust: 50, ease: 2.5 },
    { minBust: 40, ease: 2.0 },
  ],
  armholeEaseDefault: 1.5,
  /** `armholeDepth = (bust / 6 + armholeEase) * PT`. */
  armholeDepthDivisor: 6,

  /** `neckWidth = shoulderWidth/2 - shortSide(shoulderSeamLength, shoulderDrop)`,
   *  falling back to this when the triangle is invalid. */
  neckWidthFallback: 2.75,

  /** Dart placement on the waistline: `bustSpan/2 - 0.5` (both blocks). */
  dartPlacementOffset: 0.5,
  /** Front dart's first leg (J1) drop below J: `0.125 * PT`. */
  frontDartLegDrop: 0.125,

  /** Front side-extension tiers from `deltaL = frontBodiceLength - backBodiceLength`. */
  sideExtensionTiers: [
    { minDeltaL: 3.0, extension: 1.5 },
    { minDeltaL: 1.0, extension: 1.25 },
  ],
  sideExtensionDefault: 0,

  /** Back shoulder dart: `E1 = pointAtAngle(E, angleFE, 0.5*PT)`,
   *  `P1/P2 = pointAtAngle(P, angleFE, ∓0.25*PT)`. */
  backShoulderDartOffset: 0.5,
  backShoulderDartHalfWidth: 0.25,
  /** `qDistance = sideSeamLength/3 + 1.0*PT`. */
  backShoulderDartQOffset: 1.0,

  /** Swayback contour: `B1 = {x: B.x + 0.75*PT, y: B.y}`. */
  swaybackOffset: 0.75,

  /** Back waist dart width, both branches: `H = G ± 1.0*PT`. */
  backWaistDartWidth: 1.0,
  /** Back waist-side offset when swayback is on: `waist/4 + 1.0*PT`. */
  backWaistSideSwaybackOffset: 1.0,

  /** Across-back half width: provided branch adds this ease; fallback
   *  branch (`shoulderWidth/2 - 0.25*PT`) subtracts it. */
  acrossBackEase: 0.25,

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
  centerBackLengthOffset: 0.5,
  /** No equivalent front comment in the source; offset implied by its
   *  sample defaults (frontBodiceLength 18in, centerFrontLength 14.5in). */
  centerFrontLengthOffset: 3.5,
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
  defaultSkirtLength: 70 * CM,
  hipEase: 1.5 * CM,
  /** A-line flare added at the hem beyond the hip width. */
  hemFlare: 2.5 * CM,
  /** Waist-to-hip side seam bow. */
  hipSeamBow: 0.5 * CM,
  hipSeamBowHeightRatio: 0.55,
  /** The dress dart is a diamond: this far above and below the waist. */
  dartHeightAboveWaist: { front: 8 * CM, back: 10 * CM },
  dartDepthBelowWaist: 13 * CM,
  grainlineTopRatio: 0.25,
  /** Grainline stops this far short of the hem. */
  grainlineHemClearance: 5 * CM,
} as const;

// ── Trouser block ─────────────────────────────────────────────────────────────

export const TROUSER = {
  hipEase: 2.5 * CM,
  waistEase: 1 * CM,
  /** Crotch depth = hips ÷ divisor + offset. */
  crotchDepthDivisor: 8,
  crotchDepthOffset: 3 * CM,
  /** Front crotch fork extension = hips ÷ this. */
  crotchExtensionDivisor: 16,
  thighEase: 2 * CM,
  dartShareOfIntake: 0.5,
  dartPositionRatio: 0.35,
  dartDepth: 9 * CM,
  crotchCurveControlRatio: { x: 0.6, y: 0.5 },
  kneeFromCrotchRatio: 0.5,
  grainlinePositionRatio: 0.45,
  grainlineInsetRatio: 0.15,
} as const;

// ── Sleeve block ──────────────────────────────────────────────────────────────

export const SLEEVE = {
  /** Armhole depth of the matching bodice, averaged front/back. */
  armholeDepthDivisor: 8,
  armholeDepthOffset: 7.25 * CM,
  /** Sleeve head height as a fraction of armhole depth. */
  headHeightRatio: 0.78,
  /** Bicep = chest × factor + ease. */
  bicepChestFactor: 0.32,
  bicepEase: 6 * CM,
  bicepEasePerPreset: 0.5,
  /** Wrist is the larger of bicep × this, or the chest-derived width. */
  wristBicepFloorRatio: 0.55,
  wristChestFactor: 0.17,
  wristEase: 4 * CM,
  wristEasePerPreset: 0.3,
  elbowFromHeadRatio: 0.52,
  notchHeightRatio: 0.55,
  notchLength: 1.5 * CM,
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
  viewBoxPadding: 3 * CM,
  /** Segments used to flatten a Bézier when computing bounds. */
  flattenSteps: 24,
} as const;

// ── Standard UK sizes ─────────────────────────────────────────────────────────

export const UK_SIZES: readonly UKSize[] = [
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "18",
  "20",
  "22",
] as const;

/** Standard body measurements (inches) per UK size. */
export const STANDARD_SIZES: Record<UKSize, Measurements> = {
  "6": {
    chest: 80 * CM,
    waist: 61 * CM,
    hips: 86 * CM,
    shoulder: 38 * CM,
    sleeveLength: 59 * CM,
    inseam: 78 * CM,
    neck: 34 * CM,
    thigh: 52 * CM,
    height: 162 * CM,
  },
  "8": {
    chest: 83 * CM,
    waist: 64 * CM,
    hips: 89 * CM,
    shoulder: 38.5 * CM,
    sleeveLength: 59 * CM,
    inseam: 79 * CM,
    neck: 35 * CM,
    thigh: 54 * CM,
    height: 163 * CM,
  },
  "10": {
    chest: 86 * CM,
    waist: 67 * CM,
    hips: 92 * CM,
    shoulder: 39 * CM,
    sleeveLength: 59.5 * CM,
    inseam: 79 * CM,
    neck: 36 * CM,
    thigh: 56 * CM,
    height: 164 * CM,
  },
  "12": {
    chest: 90 * CM,
    waist: 71 * CM,
    hips: 96 * CM,
    shoulder: 39.5 * CM,
    sleeveLength: 60 * CM,
    inseam: 79 * CM,
    neck: 37 * CM,
    thigh: 58 * CM,
    height: 165 * CM,
  },
  "14": {
    chest: 95 * CM,
    waist: 76 * CM,
    hips: 101 * CM,
    shoulder: 40 * CM,
    sleeveLength: 60.5 * CM,
    inseam: 79 * CM,
    neck: 38 * CM,
    thigh: 61 * CM,
    height: 166 * CM,
  },
  "16": {
    chest: 100 * CM,
    waist: 81 * CM,
    hips: 106 * CM,
    shoulder: 41 * CM,
    sleeveLength: 61 * CM,
    inseam: 79 * CM,
    neck: 39 * CM,
    thigh: 64 * CM,
    height: 167 * CM,
  },
  "18": {
    chest: 106 * CM,
    waist: 87 * CM,
    hips: 112 * CM,
    shoulder: 42 * CM,
    sleeveLength: 61.5 * CM,
    inseam: 79 * CM,
    neck: 40 * CM,
    thigh: 68 * CM,
    height: 167 * CM,
  },
  "20": {
    chest: 112 * CM,
    waist: 93 * CM,
    hips: 118 * CM,
    shoulder: 43 * CM,
    sleeveLength: 62 * CM,
    inseam: 79 * CM,
    neck: 41 * CM,
    thigh: 72 * CM,
    height: 168 * CM,
  },
  "22": {
    chest: 118 * CM,
    waist: 99 * CM,
    hips: 124 * CM,
    shoulder: 44 * CM,
    sleeveLength: 62 * CM,
    inseam: 79 * CM,
    neck: 42 * CM,
    thigh: 76 * CM,
    height: 168 * CM,
  },
};
