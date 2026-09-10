/**
 * AtelierHQ Pattern Engine
 *
 * Public surface for pattern drafting. The bodice is drafted by the layered
 * engine in `./pattern/`, which follows a point-by-point block method: every
 * point is computed from a measurement and carries the formula that produced it.
 *
 * The skirt, trouser, sleeve and dress blocks below still use the older
 * quarter-measurement construction and are being ported onto the same
 * foundation. All blocks are BASIC DRAFTS and must be trued up and fit-checked
 * before cutting fabric.
 *
 * Units: inches. SVG path `d` strings use inch coordinates. Every magic
 * number below is written as `originalCmValue * CM` rather than a bare inch
 * literal — this engine's previous unit was centimetres, and writing it this
 * way keeps the original cm value visible/auditable right next to its
 * conversion instead of silently losing it to a rounded inch guess.
 */

import {
  bodiceBack as draftBodiceBack,
  bodiceFront as draftBodiceFront,
} from "./pattern/bodice.ts";
import {
  EASE_EXTRA,
  EASE_LABELS as EASE_LABELS_NEW,
  STANDARD_SIZES as STANDARD_SIZES_NEW,
  UK_SIZES as UK_SIZES_NEW,
} from "./pattern/constants.ts";
import {
  BLOCK_LABELS as BLOCK_LABELS_NEW,
  BLOCK_REQUIRED as BLOCK_REQUIRED_NEW,
  BLOCK_TYPES as BLOCK_TYPES_NEW,
} from "./pattern/types.ts";
import type {
  BlockOptions as BlockOptionsNew,
  BlockType as BlockTypeNew,
  Diagnostic,
  EasePreset as EasePresetNew,
  Estimate,
  MeasurementKey,
  Measurements as MeasurementsNew,
  PathType as PathTypeNew,
  PatternBlock as PatternBlockNew,
  PatternLabel as PatternLabelNew,
  PatternPath as PatternPathNew,
  UKSize as UKSizeNew,
} from "./pattern/types.ts";

/** 1 centimetre in inches. */
const CM = 1 / 2.54;

// Re-exported so existing imports from "@/lib/pattern-engine.ts" keep working.
export type Measurements = MeasurementsNew;
export type BlockType = BlockTypeNew;
export type EasePreset = EasePresetNew;
export type UKSize = UKSizeNew;
export type PathType = PathTypeNew;
export type PatternPath = PatternPathNew;
export type PatternLabel = PatternLabelNew;
export type PatternBlock = PatternBlockNew;
export type BlockOptions = BlockOptionsNew;
export type { Diagnostic, Estimate, MeasurementKey };

export const BLOCK_TYPES = BLOCK_TYPES_NEW;
export const BLOCK_LABELS = BLOCK_LABELS_NEW;
export const BLOCK_REQUIRED = BLOCK_REQUIRED_NEW;
export const EASE_LABELS = EASE_LABELS_NEW;
export const UK_SIZES = UK_SIZES_NEW;
export const STANDARD_SIZES = STANDARD_SIZES_NEW;

// ── Catalog metadata ──────────────────────────────────────────────────────────

export type CatalogEntry = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  blocks: BlockType[];
  required: string[];
  thumbnail: "skirt" | "bodice" | "trouser" | "sleeve" | "dress";
};

export const CATALOG: CatalogEntry[] = [
  {
    id: "skirt",
    title: "Skirt Block",
    subtitle: "Basic Skirt Sloper",
    description:
      "A-line front and back skirt block with waist dart and hip shaping. Foundation for all skirt styles.",
    blocks: ["skirt-front", "skirt-back"],
    required: ["waist", "hips"],
    thumbnail: "skirt",
  },
  {
    id: "bodice",
    title: "Bodice Block",
    subtitle: "Basic Bodice Sloper",
    description:
      "Front and back bodice block with armhole, neckline, and waist dart. Foundation for tops, dresses, and jackets.",
    blocks: ["bodice-front", "bodice-back"],
    required: ["chest", "waist", "shoulder"],
    thumbnail: "bodice",
  },
  {
    id: "trouser",
    title: "Trouser Block",
    subtitle: "Basic Trouser Sloper",
    description:
      "Front trouser block with crotch curve, waist dart, and hip shaping. Foundation for trousers and shorts.",
    blocks: ["trouser"],
    required: ["waist", "hips", "inseam"],
    thumbnail: "trouser",
  },
  {
    id: "sleeve",
    title: "Sleeve Block",
    subtitle: "Basic Set-In Sleeve",
    description:
      "One-piece set-in sleeve with sleeve head curve, elbow line, and wrist shaping. Drafts to match the bodice armhole.",
    blocks: ["sleeve"],
    required: ["shoulder", "sleeveLength", "chest"],
    thumbnail: "sleeve",
  },
  {
    id: "dress",
    title: "Dress Block",
    subtitle: "Bodice + Skirt Combined",
    description:
      "Full-length dress block joining the bodice at the waist to an extended skirt. Foundation for shift and sheath dresses.",
    blocks: ["dress-front", "dress-back"],
    required: ["chest", "waist", "hips", "shoulder"],
    thumbnail: "dress",
  },
];

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Fills in the fields the legacy blocks do not yet compute, so they satisfy the
 * richer `PatternBlock` contract the layered engine produces.
 *
 * Removed as each block is ported onto the new foundation.
 */
function legacyExtras(
  garment: "skirt" | "trouser" | "sleeve" | "dress",
  panel: "front" | "back" | "sleeve",
  m: Measurements,
  cutOnFold: boolean,
): Pick<
  PatternBlock,
  "diagnostics" | "calculations" | "estimates" | "metadata"
> {
  return {
    diagnostics: [
      {
        code: "NO_SEAM_ALLOWANCE",
        severity: "info",
        message: "No seam allowance is included. Add it before cutting.",
      },
      {
        code: "VERIFY_BEFORE_CUTTING",
        severity: "warning",
        message:
          "This is a basic draft. True up the seams and check the fit on a toile before cutting fabric.",
      },
    ],
    calculations: {},
    estimates: [],
    metadata: { garment, panel, cutOnFold, measurements: m },
  };
}

function emptyBlock(id: BlockType, missing: MeasurementKey[]): PatternBlock {
  return {
    id,
    name: BLOCK_LABELS[id],
    viewBox: { x: 0, y: 0, w: 30 * CM, h: 40 * CM },
    paths: [],
    labels: [
      {
        x: 15 * CM,
        y: 18 * CM,
        text: `Missing: ${missing.join(", ")}`,
        anchor: "middle",
        fontSize: 5,
      },
      {
        x: 15 * CM,
        y: 24 * CM,
        text: BLOCK_LABELS[id],
        anchor: "middle",
        fontSize: 7,
      },
    ],
    notes: [],
    diagnostics: missing.map((field) => ({
      code: "MEASUREMENT_MISSING" as const,
      severity: "error" as const,
      field,
      message: `${field} is required for this block.`,
    })),
    calculations: {},
    estimates: [],
    metadata: {
      garment: "skirt",
      panel: id.endsWith("back") ? "back" : "front",
      cutOnFold: false,
      measurements: {},
    },
    missingMeasurements: missing,
  };
}

function pad(
  viewBox: PatternBlock["viewBox"],
  p: number,
): PatternBlock["viewBox"] {
  return {
    x: viewBox.x - p,
    y: viewBox.y - p,
    w: viewBox.w + p * 2,
    h: viewBox.h + p * 2,
  };
}

/**
 * Tailors record the shoulder measurement two different ways:
 *  - cross shoulder: right tip across the back to the left tip (≈ 14.2–18.1 in)
 *  - single shoulder seam: neck point to shoulder tip (≈ 4.3–6.3 in)
 *
 * Values of 11.8 in or more are read as cross shoulder and halved; anything
 * smaller is taken as a single seam. The tip is then clamped to stay inside the
 * side seam so the armhole can never invert or bulge past the block edge.
 */
function resolveShoulder(
  shoulder: number,
  neckW: number,
  sideSeamX: number,
): { spx: number; shLen: number } {
  const rawSeam = shoulder >= 30 * CM ? shoulder / 2 - neckW : shoulder;
  const maxSeam = Math.max(4 * CM, sideSeamX - neckW - 2.5 * CM);
  const shLen = Math.min(Math.max(rawSeam, 4 * CM), maxSeam);
  return { shLen, spx: neckW + shLen };
}

/**
 * Classic scooped armhole as a cubic Bézier running from the shoulder tip down
 * to the underarm point. The curve drops almost vertically off the shoulder,
 * hollows inward through the middle, then runs into the underarm — so it always
 * stays inside the side seam instead of ballooning outward.
 */
function armholeCurve(
  spx: number,
  spy: number,
  sideSeamX: number,
  AD: number,
): string {
  const w = Math.max(sideSeamX - spx, 0.1 * CM);
  const h = Math.max(AD - spy, 0.1 * CM);
  const cp1x = spx + w * 0.08;
  const cp1y = spy + h * 0.44;
  const cp2x = spx + w * 0.46;
  const cp2y = AD;
  return `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${sideSeamX} ${AD}`;
}

// ── Skirt Front ───────────────────────────────────────────────────────────────
export function skirtFront(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  if (!m.waist || !m.hips) return emptyBlock("skirt-front", ["waist", "hips"]);

  const E = EASE_EXTRA[opts.ease ?? "standard"];
  const L = opts.skirtLength ?? 60 * CM;
  const HL = 20 * CM;
  const wq = m.waist / 4 + 1 * CM + E * 0.25;
  const hq = m.hips / 4 + 1.5 * CM + E * 0.25;
  const intake = Math.max(0, hq - wq);
  const dartW = intake / 2;
  const sideWaistX = wq + dartW;

  const dartCx = wq * 0.42;
  const dartL = dartCx - dartW / 2;
  const dartR = dartCx + dartW / 2;
  const dartDepth = 10 * CM;

  const outline = `M 0 0 L ${sideWaistX} 0 L ${hq} ${HL} L ${hq} ${L} L 0 ${L} Z`;
  const dart = `M ${dartL} 0 L ${dartCx} ${dartDepth} L ${dartR} 0`;
  const hipLine = `M 0 ${HL} L ${hq} ${HL}`;
  const gx = hq * 0.63;
  const grain = `M ${gx} ${L * 0.15} L ${gx} ${L * 0.85}`;

  return {
    id: "skirt-front",
    name: "Skirt Front",
    viewBox: pad({ x: 0, y: 0, w: hq, h: L }, 3 * CM),
    paths: [
      { d: outline, type: "outline" },
      { d: dart, type: "dart" },
      { d: hipLine, type: "construction" },
      { d: grain, type: "grainline" },
    ],
    labels: [
      {
        x: hq * 0.55,
        y: L * 0.44,
        text: "SKIRT FRONT",
        anchor: "middle",
        fontSize: 5.5,
      },
      {
        x: hq * 0.55,
        y: L * 0.51,
        text: `W ${m.waist}  H ${m.hips}  L ${L.toFixed(1)} in`,
        anchor: "middle",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: HL - 1.5 * CM,
        text: "Hip line",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: -0.5,
        y: L / 2,
        text: "C F",
        anchor: "middle",
        fontSize: 4,
        rotate: -90,
      },
      {
        x: hq + 0.5,
        y: L / 2,
        text: "Side seam",
        anchor: "middle",
        fontSize: 3.5,
        rotate: 90,
      },
    ],
    notes: [
      `Dart: width ${dartW.toFixed(1)} in, depth ${dartDepth.toFixed(1)} in`,
      "No seam allowance included — add before cutting",
      "BASIC DRAFT — true up and verify fit before cutting fabric",
    ],
    ...legacyExtras("skirt", "front", m, false),
    missingMeasurements: [],
  };
}

// ── Skirt Back ────────────────────────────────────────────────────────────────
export function skirtBack(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  if (!m.waist || !m.hips) return emptyBlock("skirt-back", ["waist", "hips"]);

  const E = EASE_EXTRA[opts.ease ?? "standard"];
  const L = opts.skirtLength ?? 60 * CM;
  const HL = 20 * CM;
  const wq = m.waist / 4 + 0.5 * CM + E * 0.25;
  const hq = m.hips / 4 + 1.5 * CM + E * 0.25;
  const intake = Math.max(0, hq - wq);
  const dartW = intake / 2;
  const sideWaistX = wq + dartW;

  const dartCx = wq * 0.52; // slightly further from CB vs front CF
  const dartL = dartCx - dartW / 2;
  const dartR = dartCx + dartW / 2;
  const dartDepth = 13 * CM; // back dart is longer

  const outline = `M 0 0 L ${sideWaistX} 0 L ${hq} ${HL} L ${hq} ${L} L 0 ${L} Z`;
  const dart = `M ${dartL} 0 L ${dartCx} ${dartDepth} L ${dartR} 0`;
  const hipLine = `M 0 ${HL} L ${hq} ${HL}`;
  const gx = hq * 0.63;
  const grain = `M ${gx} ${L * 0.15} L ${gx} ${L * 0.85}`;
  const foldLine = `M 0 0 L 0 ${L}`; // CB fold

  return {
    id: "skirt-back",
    name: "Skirt Back",
    viewBox: pad({ x: 0, y: 0, w: hq, h: L }, 3 * CM),
    paths: [
      { d: outline, type: "outline" },
      { d: dart, type: "dart" },
      { d: hipLine, type: "construction" },
      { d: grain, type: "grainline" },
      { d: foldLine, type: "fold" },
    ],
    labels: [
      {
        x: hq * 0.55,
        y: L * 0.44,
        text: "SKIRT BACK",
        anchor: "middle",
        fontSize: 5.5,
      },
      {
        x: hq * 0.55,
        y: L * 0.51,
        text: `W ${m.waist}  H ${m.hips}  L ${L.toFixed(1)} in`,
        anchor: "middle",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: HL - 1.5 * CM,
        text: "Hip line",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: -0.5,
        y: L / 2,
        text: "C B  (fold)",
        anchor: "middle",
        fontSize: 4,
        rotate: -90,
      },
    ],
    notes: [
      `Dart: width ${dartW.toFixed(1)} in, depth ${dartDepth.toFixed(1)} in`,
      "CB is fold line — cut on fold",
      "No seam allowance included — add before cutting",
      "BASIC DRAFT — true up and verify fit before cutting fabric",
    ],
    ...legacyExtras("skirt", "back", m, true),
    missingMeasurements: [],
  };
}

// ── Bodice ────────────────────────────────────────────────────────────────────
// Drafted by the layered engine in ./pattern/, which follows the point-by-point
// block method: named points, a real bust dart rotated around the bust point,
// and a back shoulder dart for shoulder-blade shaping.

export function bodiceFront(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  return draftBodiceFront(m, opts);
}

export function bodiceBack(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  return draftBodiceBack(m, opts);
}

// ── Trouser Front ─────────────────────────────────────────────────────────────
export function trouserBlock(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  if (!m.waist || !m.hips || !m.inseam)
    return emptyBlock("trouser", ["waist", "hips", "inseam"]);

  const E = EASE_EXTRA[opts.ease ?? "standard"];
  const waist = m.waist;
  const hips = m.hips;
  const inseam = m.inseam;
  const thigh = m.thigh ?? hips * 0.62;

  const hipQ = hips / 4 + 2.5 * CM + E * 0.25;
  const waistQ = waist / 4 + 1 * CM + E * 0.25;
  const crotchD = hips / 8 + 3 * CM; // crotch depth from waist
  const crotchExt = hips / 16; // front crotch fork extension
  const thighQ = thigh / 4 + 2 * CM; // quarter thigh
  const totalH = crotchD + inseam;

  // Waist dart
  const intakeTrs = Math.max(0, hipQ - waistQ);
  const dartWTrs = intakeTrs * 0.5;
  const dartXTrs = hipQ * 0.35;
  const dartLTrs = dartXTrs - dartWTrs / 2;
  const dartRTrs = dartXTrs + dartWTrs / 2;
  const dartDTrs = 9 * CM;

  // Side waist x (before dart)
  const sideWaistX = waistQ + dartWTrs;

  // Outline: outer seam → inner seam (with crotch curve) → hem
  // A(0,0) outer waist → B(sideWaistX, 0) inner waist →
  // curve to crotch fork C(sideWaistX + crotchExt, crotchD) →
  // straight to inner hem D(thighQ, totalH) →
  // straight to outer hem E(hipQ - thighQ, totalH) →
  // straight up outer seam to A

  // Hem width = thighQ * 2 centered on the trouser center
  const hemInX = sideWaistX + crotchExt; // same x as crotch fork
  const hemOutX = 0; // same as outer seam (straight side seam)

  const outline = `M 0 0 L ${sideWaistX} 0 Q ${sideWaistX + crotchExt * 0.6} ${crotchD * 0.5} ${sideWaistX + crotchExt} ${crotchD} L ${hemInX} ${totalH} L ${hemOutX} ${totalH} Z`;

  const waistDart = `M ${dartLTrs} 0 L ${dartXTrs} ${dartDTrs} L ${dartRTrs} 0`;
  const crotchLine = `M 0 ${crotchD} L ${sideWaistX + crotchExt} ${crotchD}`;
  const knee = crotchD + inseam * 0.5;
  const kneeLine = `M 0 ${knee} L ${sideWaistX + crotchExt} ${knee}`;
  const gx = (sideWaistX + crotchExt) * 0.45;
  const grain = `M ${gx} ${totalH * 0.15} L ${gx} ${totalH * 0.85}`;

  return {
    id: "trouser",
    name: "Trouser Front",
    viewBox: pad({ x: 0, y: 0, w: sideWaistX + crotchExt, h: totalH }, 3 * CM),
    paths: [
      { d: outline, type: "outline" },
      { d: waistDart, type: "dart" },
      { d: crotchLine, type: "construction" },
      { d: kneeLine, type: "construction" },
      { d: grain, type: "grainline" },
    ],
    labels: [
      {
        x: (sideWaistX + crotchExt) * 0.4,
        y: totalH * 0.42,
        text: "TROUSER FRONT",
        anchor: "middle",
        fontSize: 5,
      },
      {
        x: (sideWaistX + crotchExt) * 0.4,
        y: totalH * 0.49,
        text: `W ${waist}  H ${hips}  In ${inseam} in`,
        anchor: "middle",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: crotchD - 1.5 * CM,
        text: "Crotch",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: knee - 1.5 * CM,
        text: "Knee",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: -0.5,
        y: totalH / 2,
        text: "Side seam",
        anchor: "middle",
        fontSize: 3.5,
        rotate: -90,
      },
    ],
    notes: [
      `Crotch depth: ${crotchD.toFixed(1)} in`,
      `Crotch extension: ${crotchExt.toFixed(1)} in`,
      "Trouser back needs separate block with deeper back crotch",
      "No seam allowance — add before cutting",
      "BASIC DRAFT — true up and verify fit before cutting fabric",
    ],
    ...legacyExtras("trouser", "front", m, false),
    missingMeasurements: [],
  };
}

// ── Sleeve (one-piece set-in sleeve) ─────────────────────────────────────────
export function sleeveBlock(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  if (!m.shoulder || !m.sleeveLength || !m.chest)
    return emptyBlock("sleeve", ["shoulder", "sleeveLength", "chest"]);

  const E = EASE_EXTRA[opts.ease ?? "standard"];
  const chest = m.chest;
  const L = m.sleeveLength;

  // Armhole depth of the matching bodice drives the sleeve head height
  const AD = chest / 8 + 7.25 * CM;
  const headH = AD * 0.78;

  // Bicep circumference = flat pattern width (underarm seam joins both edges)
  const bicep = chest * 0.32 + 6 * CM + E * 0.5;
  const W = bicep;
  const wristW = Math.max(W * 0.55, chest * 0.17 + 4 * CM + E * 0.3);
  const off = (W - wristW) / 2;

  const cx = W / 2;
  const elbowY = headH + (L - headH) * 0.52;

  // Sleeve head: front half flatter, back half fuller.
  // Built from quadratic segments only, so it renders identically in PDF export.
  const fx = W * 0.22;
  const fy = headH * 0.22;
  const bx = W * 0.8;
  const by = headH * 0.25;

  const headFront = `M 0 ${headH} Q ${W * 0.06} ${headH * 0.45} ${fx} ${fy} Q ${W * 0.36} ${headH * 0.01} ${cx} 0`;
  const headBack = `M ${cx} 0 Q ${W * 0.68} ${headH * 0.02} ${bx} ${by} Q ${W * 0.94} ${headH * 0.52} ${W} ${headH}`;

  const outline =
    `M 0 ${headH} Q ${W * 0.06} ${headH * 0.45} ${fx} ${fy} Q ${W * 0.36} ${headH * 0.01} ${cx} 0 ` +
    `Q ${W * 0.68} ${headH * 0.02} ${bx} ${by} Q ${W * 0.94} ${headH * 0.52} ${W} ${headH} ` +
    `L ${W - off} ${L} L ${off} ${L} Z`;

  const bicepLine = `M 0 ${headH} L ${W} ${headH}`;
  const elbowLine = `M ${off * 0.5} ${elbowY} L ${W - off * 0.5} ${elbowY}`;
  const centreLine = `M ${cx} 0 L ${cx} ${L}`;
  const grain = `M ${cx} ${L * 0.2} L ${cx} ${L * 0.82}`;

  // Balance notches: single at front head, double at back head
  const notchY = headH * 0.55;
  const notchLen = 1.5 * CM;
  const frontNotch = `M ${W * 0.2} ${notchY} L ${W * 0.2} ${notchY + notchLen}`;
  const backNotchA = `M ${W * 0.78} ${notchY} L ${W * 0.78} ${notchY + notchLen}`;
  const backNotchB = `M ${W * 0.82} ${notchY} L ${W * 0.82} ${notchY + notchLen}`;

  return {
    id: "sleeve",
    name: "Sleeve",
    viewBox: pad({ x: 0, y: 0, w: W, h: L }, 3 * CM),
    paths: [
      { d: outline, type: "outline" },
      { d: headFront, type: "construction" },
      { d: headBack, type: "construction" },
      { d: bicepLine, type: "construction" },
      { d: elbowLine, type: "construction" },
      { d: centreLine, type: "construction" },
      { d: frontNotch, type: "dart" },
      { d: backNotchA, type: "dart" },
      { d: backNotchB, type: "dart" },
      { d: grain, type: "grainline" },
    ],
    labels: [
      { x: cx, y: L * 0.5, text: "SLEEVE", anchor: "middle", fontSize: 5.5 },
      {
        x: cx,
        y: L * 0.57,
        text: `Sl ${L}  Bicep ${bicep.toFixed(1)} in`,
        anchor: "middle",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: headH - 1.5 * CM,
        text: "Bicep line",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: off * 0.5 + 1,
        y: elbowY - 1.5 * CM,
        text: "Elbow line",
        anchor: "start",
        fontSize: 3.5,
      },
      { x: W * 0.2, y: notchY - 1, text: "F", anchor: "middle", fontSize: 3.5 },
      { x: W * 0.8, y: notchY - 1, text: "B", anchor: "middle", fontSize: 3.5 },
    ],
    notes: [
      `Sleeve head height: ${headH.toFixed(1)} in`,
      `Bicep width: ${bicep.toFixed(1)} in · Wrist: ${wristW.toFixed(1)} in`,
      "Walk the sleeve head against the bodice armhole — aim for 0.8–1.6 in ease",
      "Single notch matches the front armhole, double notch the back",
      "No seam allowance — add before cutting",
      "BASIC DRAFT — true up and verify fit before cutting fabric",
    ],
    ...legacyExtras("sleeve", "sleeve", m, false),
    missingMeasurements: [],
  };
}

// ── Dress (bodice + extended skirt) ──────────────────────────────────────────
function dressPanel(
  kind: "front" | "back",
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  const id: BlockType = kind === "front" ? "dress-front" : "dress-back";
  if (!m.chest || !m.waist || !m.hips || !m.shoulder)
    return emptyBlock(id, ["chest", "waist", "hips", "shoulder"]);

  const isFront = kind === "front";
  const E = EASE_EXTRA[opts.ease ?? "standard"];
  const { chest, waist, hips, shoulder } = m;
  const neck = m.neck ?? chest / 2.6;

  const AD = chest / 8 + (isFront ? 7 : 7.5) * CM;
  const Blen = m.height
    ? m.height * (isFront ? 0.245 : 0.247)
    : (isFront ? 41 : 41.5) * CM;
  const bustQ = chest / 4 + (isFront ? 3 : 2.5) * CM + E * 0.25;
  const waistQ = waist / 4 + (isFront ? 1.5 : 1) * CM + E * 0.25;
  const hipQ = hips / 4 + 1.5 * CM + E * 0.25;

  const neckW = isFront ? neck / 5 : neck / 5 - 0.5 * CM;
  const neckD = isFront ? neck / 5 + 1.5 * CM : 2.5 * CM;
  const shSlope = (isFront ? 1.5 : 2) * CM;
  const nx = neckW;
  const spy = shSlope;
  const { spx, shLen } = resolveShoulder(shoulder, neckW, bustQ);

  const HL = 20 * CM; // waist to hip
  const skirtLen = opts.dressLength ?? 70 * CM; // waist to hem
  const hipY = Blen + HL;
  const hemY = Blen + skirtLen;
  const hemX = hipQ + 2.5 * CM; // slight A-line flare

  const neckCtrl = isFront ? 0 : nx * 0.3;
  const armholeSeg = armholeCurve(spx, spy, bustQ, AD);

  const outline =
    `M 0 ${neckD} Q ${neckCtrl} 0 ${nx} 0 L ${spx} ${spy} ` +
    `${armholeSeg} ` +
    `Q ${bustQ + 0.5 * CM} ${Blen * 0.62} ${waistQ} ${Blen} ` +
    `Q ${waistQ + 0.5 * CM} ${Blen + HL * 0.55} ${hipQ} ${hipY} ` +
    `L ${hemX} ${hemY} L 0 ${hemY} Z`;

  const neckline = isFront
    ? `M ${nx} 0 Q 0 0 0 ${neckD}`
    : `M ${nx} 0 Q ${nx * 0.3} 0 0 ${neckD}`;
  const shld = `M ${nx} 0 L ${spx} ${spy}`;
  const armhole = `M ${spx} ${spy} ${armholeSeg}`;
  const bustLine = `M 0 ${AD} L ${bustQ} ${AD}`;
  const waistLine = `M 0 ${Blen} L ${waistQ} ${Blen}`;
  const hipLine = `M 0 ${hipY} L ${hipQ} ${hipY}`;

  // Continuous waist dart (diamond) spanning bodice and skirt
  const intake = Math.max(0, bustQ - waistQ);
  const dartW = intake * (isFront ? 0.45 : 0.4);
  const dartX = bustQ * (isFront ? 0.35 : 0.38);
  const dartUp = (isFront ? 8 : 10) * CM;
  const dartDown = 13 * CM;
  const dart =
    `M ${dartX} ${Blen - dartUp} L ${dartX - dartW / 2} ${Blen} L ${dartX} ${Blen + dartDown} ` +
    `L ${dartX + dartW / 2} ${Blen} Z`;

  const gx = bustQ * 0.5;
  const grain = `M ${gx} ${Blen * 0.25} L ${gx} ${hemY * 0.9}`;

  const paths: PatternPath[] = [
    { d: outline, type: "outline" },
    { d: neckline, type: "construction" },
    { d: shld, type: "construction" },
    { d: armhole, type: "construction" },
    { d: bustLine, type: "construction" },
    { d: waistLine, type: "construction" },
    { d: hipLine, type: "construction" },
    { d: dart, type: "dart" },
    { d: grain, type: "grainline" },
  ];
  if (!isFront) paths.push({ d: `M 0 0 L 0 ${hemY}`, type: "fold" });

  return {
    id,
    name: BLOCK_LABELS[id],
    viewBox: pad(
      { x: 0, y: 0, w: Math.max(bustQ, hemX) + 2 * CM, h: hemY },
      3 * CM,
    ),
    paths,
    labels: [
      {
        x: bustQ * 0.5,
        y: Blen + skirtLen * 0.45,
        text: isFront ? "DRESS FRONT" : "DRESS BACK",
        anchor: "middle",
        fontSize: 5,
      },
      {
        x: bustQ * 0.5,
        y: Blen + skirtLen * 0.52,
        text: `C ${chest}  W ${waist}  H ${hips} in`,
        anchor: "middle",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: AD - 1.5 * CM,
        text: "Bust line",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: Blen - 1.5 * CM,
        text: "Waist line",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: 1,
        y: hipY - 1.5 * CM,
        text: "Hip line",
        anchor: "start",
        fontSize: 3.5,
      },
      {
        x: -0.5,
        y: hemY / 2,
        text: isFront ? "C F" : "C B  (fold)",
        anchor: "middle",
        fontSize: 4,
        rotate: -90,
      },
    ],
    notes: [
      `Bodice length: ${Blen.toFixed(1)} in · Skirt length: ${skirtLen.toFixed(1)} in`,
      `Waist dart: width ${dartW.toFixed(1)} in, ${dartUp.toFixed(1)} in up / ${dartDown.toFixed(1)} in down`,
      isFront
        ? "No bust dart — add from side seam to bust point for a fitted dress"
        : "CB is fold line — cut on fold, or add a zip seam",
      "No seam allowance — add before cutting",
      "BASIC DRAFT — true up and verify fit before cutting fabric",
    ],
    ...legacyExtras("dress", isFront ? "front" : "back", m, !isFront),
    missingMeasurements: [],
  };
}

export function dressFront(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  return dressPanel("front", m, opts);
}

export function dressBack(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock {
  return dressPanel("back", m, opts);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function generateAllBlocks(
  m: Measurements,
  opts: BlockOptions = {},
): PatternBlock[] {
  return [
    skirtFront(m, opts),
    skirtBack(m, opts),
    bodiceFront(m, opts),
    bodiceBack(m, opts),
    trouserBlock(m, opts),
    sleeveBlock(m, opts),
    dressFront(m, opts),
    dressBack(m, opts),
  ];
}
