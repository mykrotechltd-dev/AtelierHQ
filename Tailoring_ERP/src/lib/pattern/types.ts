/**
 * Pattern engine — shared types.
 *
 * The engine is layered:
 *
 *   Measurements  →  validation  →  draft calculation  →  geometry  →  render
 *
 * Each layer only knows about the one above it. `types.ts` holds the contracts
 * they share so no layer needs to import another's implementation.
 *
 * Units are inches throughout. SVG path `d` strings use inch coordinates,
 * so a viewBox of `w: 12` is 12 in wide.
 */

// ── Body measurements ─────────────────────────────────────────────────────────

/**
 * Measurements taken from a customer.
 *
 * Everything is optional because a tailor may have recorded only part of a
 * profile: each block declares what it needs and reports what is missing.
 *
 * `chest` is the bust/chest circumference. It keeps the name `chest` because
 * that is the field name already stored against every customer record.
 *
 * The `…ToWaist` and bust-point fields are direct body measurements. When
 * present the engine uses them instead of deriving a value from height, which
 * is the difference between a bespoke draft and a scaled standard size.
 */
export type Measurements = {
  chest?: number;
  waist?: number;
  hips?: number;
  shoulder?: number;
  sleeveLength?: number;
  inseam?: number;
  neck?: number;
  thigh?: number;
  height?: number;

  /** Nape to waist, measured down the centre back. Preferred over height ratio. */
  backNeckToWaist?: number;
  /** Front neck point to waist, measured down the centre front over the bust. */
  frontNeckToWaist?: number;
  /** Waist to hip level. Defaults to a standard 7.9 in drop. */
  waistToHip?: number;
  /** Across back, armhole to armhole. Estimated from bust when absent. */
  backWidth?: number;
  /** Bust point to bust point (apex to apex). Drives bust dart placement. */
  bustPointSep?: number;
  /** Neck point to bust point. The bust dart pivots around this. */
  shoulderToBust?: number;

  // ── Lety Antony / Helen Joseph-Armstrong bodice method (ported from
  // PatternLab's FrontBodiceDashboard.tsx) — all optional, estimated from
  // the fields above when not measured, same as every other field here.
  /** Vertical drop from the shoulder-width line to the true shoulder tip. */
  shoulderDrop?: number;
  /** Neck point down to the bust apex. */
  bustDepth?: number;
  /** Centre front, neck pit to waist — distinct from `frontNeckToWaist`,
   *  which is measured over the bust; this method's own construction length. */
  centerFrontLength?: number;
  /** Half of the across-chest measurement, at armhole-depth level. */
  acrossChestWidth?: number;
  /** Centre back, nape to waist, for this method's own construction. */
  centerBackLength?: number;
  /** Half of the across-back measurement. Estimated from shoulder width when absent. */
  acrossBackWidth?: number;
  /** Underarm to waist, taken directly (both blocks share one value so the
   *  front and back side seams match by construction). */
  sideSeamLength?: number;
};

/** Every key of `Measurements`, for validation and missing-field reporting. */
export type MeasurementKey = keyof Measurements;

export type UKSize = "6" | "8" | "10" | "12" | "14" | "16" | "18" | "20" | "22";

// ── Diagnostics ───────────────────────────────────────────────────────────────

export type DiagnosticSeverity = "info" | "warning" | "error";

/**
 * A structured message about a draft.
 *
 * Structured rather than a bare string so the UI can group, icon and filter
 * them, and so a caller can react to a specific `code` without string matching.
 */
export type Diagnostic = {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  /** The measurement this refers to, when it is about one. */
  field?: MeasurementKey;
};

export type DiagnosticCode =
  // errors
  | "MEASUREMENT_MISSING"
  | "MEASUREMENT_NOT_A_NUMBER"
  | "MEASUREMENT_NOT_POSITIVE"
  // warnings — measurement relationships that are possible but unusual
  | "WAIST_EXCEEDS_HIP"
  | "WAIST_EXCEEDS_CHEST"
  | "SHOULDER_OUT_OF_RANGE"
  | "NECK_OUT_OF_RANGE"
  | "HEIGHT_OUT_OF_RANGE"
  | "NO_WAIST_SUPPRESSION"
  | "SHOULDER_CLAMPED"
  | "EASE_UNRECOGNISED"
  // info — assumptions the draft made on the tailor's behalf
  | "MEASUREMENT_ESTIMATED"
  | "SHOULDER_READ_AS_CROSS"
  | "SHOULDER_READ_AS_SEAM"
  | "NO_SEAM_ALLOWANCE"
  | "NO_BUST_DART"
  | "CUT_ON_FOLD"
  | "VERIFY_BEFORE_CUTTING"
  | "SEPARATE_BACK_BLOCK_NEEDED"
  | "WALK_SLEEVE_HEAD";

export type ValidationResult = {
  valid: boolean;
  diagnostics: Diagnostic[];
};

/** A value the engine derived because the tailor did not supply it. */
export type Estimate = {
  field: MeasurementKey;
  value: number;
  /** Human-readable description of the derivation, e.g. "chest ÷ 2.6". */
  from: string;
};

// ── Geometry ──────────────────────────────────────────────────────────────────

export type Point = { x: number; y: number };

export type Bounds = { x: number; y: number; w: number; h: number };

export type PathType =
  "outline" | "dart" | "grainline" | "construction" | "fold";

export type PatternPath = { d: string; type: PathType };

export type PatternLabel = {
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
  fontSize?: number;
  rotate?: number;
};

// ── Blocks ────────────────────────────────────────────────────────────────────

export const BLOCK_TYPES = [
  "skirt-front",
  "skirt-back",
  "bodice-front",
  "bodice-back",
  "trouser",
  "sleeve",
  "dress-front",
  "dress-back",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  "skirt-front": "Skirt Front",
  "skirt-back": "Skirt Back",
  "bodice-front": "Bodice Front",
  "bodice-back": "Bodice Back",
  trouser: "Trouser Front",
  sleeve: "Sleeve",
  "dress-front": "Dress Front",
  "dress-back": "Dress Back",
};

/** Measurements each block cannot draft without. */
export const BLOCK_REQUIRED: Record<BlockType, readonly MeasurementKey[]> = {
  "skirt-front": ["waist", "hips"],
  "skirt-back": ["waist", "hips"],
  "bodice-front": ["chest", "waist", "shoulder"],
  "bodice-back": ["chest", "waist", "shoulder"],
  trouser: ["waist", "hips", "inseam"],
  sleeve: ["shoulder", "sleeveLength", "chest"],
  "dress-front": ["chest", "waist", "hips", "shoulder"],
  "dress-back": ["chest", "waist", "hips", "shoulder"],
};

export type PanelSide = "front" | "back";

export type GarmentType = "skirt" | "bodice" | "trouser" | "sleeve" | "dress";

/** Non-geometric facts about a block, kept separate so the UI can localise. */
export type BlockMetadata = {
  garment: GarmentType;
  panel: PanelSide | "sleeve";
  /** True when the centre line is a fold rather than a seam. */
  cutOnFold: boolean;
  /** Measurements actually used, after estimation. */
  measurements: Measurements;
};

/**
 * A drafted pattern block: geometry plus everything needed to explain it.
 *
 * `calculations` exposes the intermediate drafting values (armhole depth, bust
 * quarter, dart intake…) so they can be shown in the UI, compared between
 * drafts, or asserted in tests without re-deriving them from path strings.
 */
export type PatternBlock = {
  id: BlockType;
  name: string;
  viewBox: Bounds;
  paths: PatternPath[];
  labels: PatternLabel[];
  /** Calculation summaries, e.g. "Armhole depth: 7.1 in". */
  notes: string[];
  /** Structured advisories and anomalies. */
  diagnostics: Diagnostic[];
  /** Named drafting values, in inches. */
  calculations: Record<string, number>;
  /** Values the engine derived rather than measured. */
  estimates: Estimate[];
  metadata: BlockMetadata;
  missingMeasurements: MeasurementKey[];
};

// ── Options ───────────────────────────────────────────────────────────────────

export type EasePreset = "fitted" | "standard" | "relaxed";

export type BlockOptions = {
  /** Waist-to-hem length of a standalone skirt (in). */
  skirtLength?: number;
  /** Waist-to-hem length of the skirt portion of a dress (in). */
  dressLength?: number;
  ease?: EasePreset;

  // ── Bodice construction toggles (Lety Antony / Helen Joseph-Armstrong
  // method, ported from PatternLab's FrontBodiceDashboard.tsx) — construction
  // choices the tailor makes per garment, not body measurements, so they sit
  // here alongside `ease` rather than on `Measurements`.
  /** Back shoulder dart for shoulder-blade shaping. Defaults on. */
  bodiceShoulderDart?: boolean;
  /** Contoured (swayback) centre-back waist. Defaults on. */
  bodiceSwayback?: boolean;
};
