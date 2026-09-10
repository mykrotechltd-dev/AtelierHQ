/**
 * Bodice draft calculator.
 *
 * Ported from PatternLab's `src/components/patterns/FrontBodiceDashboard.tsx`
 * — a term-for-term port there of two Adobe Illustrator ExtendScript files,
 * `NewFront-bodice.jsx` (the "Lety Antony" method) and `NewBack_bodice.jsx`.
 * Every point below carries a comment naming the PatternLab point/variable it
 * replaces. One coordinate change was needed to bring the source's formulas
 * into this engine's convention, applied once at the very end of each panel's
 * point set (search `flip` below), never mid-formula:
 *
 *   - Units: the source works in inches, scaled ×72 ("PT") purely for its own
 *     SVG canvas — that scale is dropped entirely and the underlying inch
 *     value is used as-is, since this engine's own native unit is inches too
 *     (see `constants.ts`'s `BODICE` object, transcribed directly with no
 *     conversion factor).
 *   - Coordinates: the source is Y-up with negative-x toward the shoulder/
 *     side (an inherited Illustrator-scripting convention — it flips for its
 *     own display too, see its `flip()`). This engine is Y-down with
 *     positive-x toward the side seam. Both amount to a single 180° rotation
 *     about the origin, i.e. negating x and y together — verified by hand for
 *     point B (front waist corner) and D (shoulder reference) in the PR that
 *     introduced this file.
 *
 * Produces named points and drafting values only — no SVG. Rendering is a
 * separate layer (bodice-geometry.ts), so the same draft can be drawn,
 * exported, graded, or asserted against reference values.
 */

import { BODICE, BODY, SHOULDER_CROSS_THRESHOLD } from "./constants.ts";
import {
  angleBetween,
  distance,
  openDart,
  point,
  pointAtAngle,
  type BustDart,
  type DraftPoint,
} from "./points.ts";
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
    shoulderLen: number;
    shoulderDrop: number;
    bustPointSep: number;
    bustDepth: number;
    frontBodiceLength: number;
    backBodiceLength: number;
    centerFrontLength: number;
    centerBackLength: number;
    acrossChestWidth: number;
    acrossBackWidth?: number;
    sideSeamLength: number;
  };

  /** Named drafting values, all inches. */
  calc: {
    neckWidth: number;
    armholeEase: number;
    armholeDepth?: number;
    waistDartIntake: number;
    bustDartIntake: number;
    shoulderDartIntake: number;
  };

  /**
   * Front points (panel === "front"), named after their PatternLab letter —
   * see the class-level comment and bodice-calculator's mapping notes for
   * what each represents anatomically.
   */
  front?: {
    centreNeck: DraftPoint; // C
    neckPoint: DraftPoint; // F
    shoulderPoint: DraftPoint; // G
    bustPoint: DraftPoint; // H
    acrossChestPoint: DraftPoint; // I
    underarm: DraftPoint; // K
    dartLegBase: DraftPoint; // J1 (first dart leg foot)
    dartLegApex: DraftPoint; // P (second dart leg foot)
    sideExtOuter: DraftPoint; // M
    waistSide: DraftPoint; // N
    centreWaist: DraftPoint; // B
  };

  /** Back points (panel === "back"). */
  back?: {
    centreNeck: DraftPoint; // C
    neckPoint: DraftPoint; // F
    shoulderPoint: DraftPoint; // E1 (post-dart) or E (no dart)
    acrossBackPoint: DraftPoint; // R
    underarm: DraftPoint; // O
    waistSideTop: DraftPoint; // K
    sideSeamBase: DraftPoint; // H
    waistDartLeg: DraftPoint; // J
    waistDartFoot: DraftPoint; // G1
    centreWaist: DraftPoint; // BActive
  };

  /** Back shoulder dart (shoulder-blade shaping). Back only, when enabled. */
  shoulderDart?: BustDart;
  /** Side bust dart, rotated around the bust point. Front only. */
  bustDart?: BustDart;

  waistDart: {
    x: number;
    intake: number;
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
 * present and positive. Every other field is estimated when absent, and
 * every estimate is recorded so the UI can disclose it.
 */
export function calculateBodice(
  m: Measurements,
  panel: PanelSide,
  opts: BlockOptions = {},
): BodiceDraft {
  const isFront = panel === "front";
  const estimates: Estimate[] = [];
  const diagnostics: Diagnostic[] = [];

  const bust = m.chest ?? 0;
  const waist = m.waist ?? 0;

  // ── Shared measurements (both panels need both lengths — the front block's
  // side-extension and the side-seam-length fallback both compare/derive from
  // both) ──────────────────────────────────────────────────────────────────

  // PatternLab needs two independent quantities: `shoulderWidth` (full
  // tip-to-tip, places the shoulder tip D/E) and `shoulderSeamLength` (one
  // side's seam, the hypotenuse of the neck-width triangle) — never derived
  // from each other in the source. ERP's single `shoulder` field carries
  // whichever one the tailor actually measured (auto-detected by the
  // existing cross/seam threshold), so the other is derived here using the
  // same neck-gap estimate ERP's prior method already used, applied
  // symmetrically so the pair stays consistent whichever way it was entered.
  const shoulderRaw = m.shoulder ?? 0;
  const readAsCross = shoulderRaw >= SHOULDER_CROSS_THRESHOLD;
  const neckGap = (m.neck ?? bust / BODY.neckFromChestDivisor) / 5;
  const shoulderWidth = readAsCross ? shoulderRaw : 2 * (shoulderRaw + neckGap);
  const shoulderLen = readAsCross ? shoulderRaw / 2 - neckGap : shoulderRaw;
  diagnostics.push({
    code: readAsCross ? "SHOULDER_READ_AS_CROSS" : "SHOULDER_READ_AS_SEAM",
    severity: "info",
    field: "shoulder",
    message: readAsCross
      ? `Shoulder ${shoulderRaw} in read as a tip-to-tip measurement, giving a ${shoulderLen.toFixed(1)} in shoulder seam.`
      : `Shoulder ${shoulderRaw} in read as a single shoulder seam, giving a ${shoulderWidth.toFixed(1)} in tip-to-tip width.`,
  });

  const shoulderDrop = resolve(
    m.shoulderDrop,
    () => shoulderRaw * BODICE.shoulderDropFromShoulderRatio,
    "shoulderDrop",
    "shoulder × 0.05",
    estimates,
  );

  const frontBodiceLength = resolveBodiceLength(
    m.frontNeckToWaist,
    m.height,
    BODY.frontNeckToWaistFromHeightRatio,
    BODY.fallbackBodiceLength.front,
    "frontNeckToWaist",
    estimates,
  );
  const backBodiceLength = resolveBodiceLength(
    m.backNeckToWaist,
    m.height,
    BODY.backNeckToWaistFromHeightRatio,
    BODY.fallbackBodiceLength.back,
    "backNeckToWaist",
    estimates,
  );

  const sideSeamLength = resolve(
    m.sideSeamLength,
    () => backBodiceLength * BODICE.sideSeamLengthFromBackBodiceLengthRatio,
    "sideSeamLength",
    "back bodice length × 0.43",
    estimates,
  );

  const bustPointSep = resolve(
    m.bustPointSep,
    () => bust * BODICE.bustPointSepFromBustRatio,
    "bustPointSep",
    "bust × 0.2",
    estimates,
  );

  const draft: BodiceDraft = {
    panel,
    resolved: {
      bust,
      waist,
      shoulderLen,
      shoulderDrop,
      bustPointSep,
      bustDepth: 0,
      frontBodiceLength,
      backBodiceLength,
      centerFrontLength: 0,
      centerBackLength: 0,
      acrossChestWidth: 0,
      sideSeamLength,
    },
    calc: {
      neckWidth: 0,
      armholeEase: 0,
      waistDartIntake: 0,
      bustDartIntake: 0,
      shoulderDartIntake: 0,
    },
    waistDart: { x: 0, intake: 0, height: 0 },
    estimates,
    diagnostics,
  };

  if (isFront) {
    draftFront(
      m,
      draft,
      bust,
      waist,
      shoulderWidth,
      shoulderLen,
      shoulderDrop,
      bustPointSep,
      frontBodiceLength,
      backBodiceLength,
      estimates,
    );
  } else {
    draftBack(
      m,
      draft,
      bust,
      waist,
      shoulderWidth,
      shoulderLen,
      shoulderDrop,
      backBodiceLength,
      sideSeamLength,
      opts,
      estimates,
    );
  }

  return draft;
}

// ── Front — ported from PatternLab's computeFrontBodicePoints ─────────────────

function draftFront(
  m: Measurements,
  draft: BodiceDraft,
  bust: number,
  waist: number,
  shoulderWidth: number,
  shoulderLen: number,
  shoulderDrop: number,
  bustPointSep: number,
  frontBodiceLength: number,
  backBodiceLength: number,
  estimates: Estimate[],
): void {
  const centerFrontLength = resolve(
    m.centerFrontLength,
    () => Math.max(frontBodiceLength - BODICE.centerFrontLengthOffset, 1),
    "centerFrontLength",
    "front bodice length − 3.5in",
    estimates,
  );
  const bustDepth = resolve(
    m.bustDepth,
    () => bust * BODICE.bustDepthFromBustRatio,
    "bustDepth",
    "bust × 0.25",
    estimates,
  );
  const acrossChestWidth = resolve(
    m.acrossChestWidth,
    () => bust * BODICE.acrossChestWidthFromBustRatio,
    "acrossChestWidth",
    "bust × 0.32",
    estimates,
  );

  // A: High Point Shoulder / CF top — local origin for this panel.
  // PatternLab's `A`, placed at an absolute canvas coordinate there; a pure
  // translation here since every other point is relative to it.
  const A = { x: 0, y: 0 };

  // B: Center Front waist corner. PatternLab: `B = {A.x, A.y - frontBodiceLength}`.
  const rawB = { x: A.x, y: A.y - frontBodiceLength };

  // C: Center Front neck pit. PatternLab: `C = {A.x, B.y + centerFrontLength}`.
  const rawC = { x: A.x, y: rawB.y + centerFrontLength };

  // Neck width: right triangle with the shoulder seam as hypotenuse and
  // shoulder drop as one leg. Falls back to a standard width if the inputs
  // don't form a valid triangle. PatternLab: `neckWidth = shoulderWidth/2 -
  // shortSide(shoulderSeamLength, shoulderDrop)`.
  let neckWidth = shoulderWidth / 2 - shortSide(shoulderLen, shoulderDrop);
  if (Number.isNaN(neckWidth) || neckWidth <= 0) {
    neckWidth = BODICE.neckWidthFallback;
  }

  // F: Side neck / HPS corner. PatternLab: `F = {A.x - neckWidth, A.y}`.
  const rawF = { x: A.x - neckWidth, y: A.y };

  // D: top outer shoulder reference (not drawn). PatternLab: `D = {A.x -
  // shoulderWidth/2, A.y}`.
  const rawD = { x: A.x - shoulderWidth / 2, y: A.y };

  // G: true shoulder tip, dropped by shoulderDrop. PatternLab: `G = {D.x,
  // D.y - shoulderDrop}`.
  const rawG = { x: rawD.x, y: rawD.y - shoulderDrop };

  // H: bust apex. PatternLab: `H = {A.x - bustSpan/2, A.y - bustDepth}`.
  const rawH = { x: A.x - bustPointSep / 2, y: A.y - bustDepth };

  // Armhole ease steps with bust size; K is the underarm.
  // PatternLab: tiered `armholeEase`, `armholeDepth = bust/6 + armholeEase`.
  const armholeEase = tieredEase(
    bust,
    BODICE.armholeEaseTiers,
    BODICE.armholeEaseDefault,
  );
  const armholeDepth = bust / BODICE.armholeDepthDivisor + armholeEase;
  const totalVerticalDrop = shoulderDrop + armholeDepth;
  const rawK = { x: A.x - bust / 4, y: A.y - totalVerticalDrop };

  // I: across-chest pitch point, vertically centred between C and K, pulled
  // in slightly. PatternLab: `I = {A.x - acrossChestWidth/2 -
  // acrossChestEase, (C.y+K.y)/2}`.
  const midCFY = (rawC.y + rawK.y) / 2;
  const rawI = {
    x: A.x - acrossChestWidth / 2 - BODICE.acrossChestEase,
    y: midCFY,
  };

  // Dart placement on the waistline, and the dart's first leg (J1), dropped
  // slightly to form a V-notch. PatternLab: `dartPlacementDist =
  // bustSpan/2 - 0.5`, `J1 = {J.x, J.y - 0.125}`.
  const dartPlacementDist = bustPointSep / 2 - BODICE.dartPlacementOffset;
  const rawJ = { x: rawB.x - dartPlacementDist, y: rawB.y };
  const rawJ1 = { x: rawJ.x, y: rawJ.y - BODICE.frontDartLegDrop };
  const leg1Length = distance(rawH, rawJ1);

  // Side extension: extra side-seam allowance when the front is meaningfully
  // longer than the back. PatternLab: tiered on `deltaL = frontBodiceLength -
  // backBodiceLength`.
  const deltaL = frontBodiceLength - backBodiceLength;
  const sideExtension = tieredEase(
    deltaL,
    BODICE.sideExtensionTiers.map((t) => ({
      minBust: t.minDeltaL,
      ease: t.extension,
    })),
    BODICE.sideExtensionDefault,
  );

  const rawL = { x: rawK.x, y: rawK.y - draftSideSeam(draft) };
  const rawM = { x: rawL.x - sideExtension, y: rawL.y };
  const angleKM = angleBetween(rawK, rawM);
  const rawN = pointAtAngle(rawK, angleKM, draftSideSeam(draft));

  // Second dart leg (P), closing the dart at the apex: the remaining waist
  // distance defines an anchor on the waistline, and P sits leg1Length from
  // H toward that anchor's direction from N.
  // PatternLab: `remainingWaistDist = waist/4 - (bustSpan/2-0.5)`.
  const remainingWaistDist = waist / 4 - dartPlacementDist;
  const angleNJ1 = angleBetween(rawN, rawJ1);
  const waistAnchorForP = pointAtAngle(rawN, angleNJ1, remainingWaistDist);
  const angleHAnchor = angleBetween(rawH, waistAnchorForP);
  const rawP = pointAtAngle(rawH, angleHAnchor, leg1Length);

  // ── Flip into this engine's frame: negate x and y together (see the
  // file-level comment for why this single transform is correct). ──────────
  const flip = (p: { x: number; y: number }) => ({ x: -p.x, y: -p.y });

  const centreNeck = point(
    "centreNeck",
    "CF neck pit",
    flip(rawC).x,
    flip(rawC).y,
    "PatternLab C",
    ["chest"],
  );
  const neckPoint = point(
    "neckPoint",
    "Side neck point",
    flip(rawF).x,
    flip(rawF).y,
    "PatternLab F",
    ["shoulder"],
  );
  const shoulderPoint = point(
    "shoulderPoint",
    "Shoulder tip",
    flip(rawG).x,
    flip(rawG).y,
    "PatternLab G",
    ["shoulder"],
  );
  const bustPoint = point(
    "bustPoint",
    "Bust apex",
    flip(rawH).x,
    flip(rawH).y,
    "PatternLab H",
    ["bustPointSep", "bustDepth"],
  );
  const acrossChestPoint = point(
    "acrossChestPoint",
    "Across chest",
    flip(rawI).x,
    flip(rawI).y,
    "PatternLab I",
    ["acrossChestWidth"],
  );
  const underarm = point(
    "underarm",
    "Underarm",
    flip(rawK).x,
    flip(rawK).y,
    "PatternLab K",
    ["chest"],
  );
  const dartLegBase = point(
    "dartLegBase",
    "Dart V-notch, waist leg",
    flip(rawJ1).x,
    flip(rawJ1).y,
    "PatternLab J1",
    ["bustPointSep"],
  );
  const dartLegApex = point(
    "dartLegApex",
    "Dart V-notch, bust leg",
    flip(rawP).x,
    flip(rawP).y,
    "PatternLab P",
    ["waist"],
  );
  const sideExtOuter = point(
    "sideExtOuter",
    "Side extension corner",
    flip(rawM).x,
    flip(rawM).y,
    "PatternLab M",
    [],
  );
  const waistSide = point(
    "waistSide",
    "Side seam at waist",
    flip(rawN).x,
    flip(rawN).y,
    "PatternLab N",
    ["waist"],
  );
  const centreWaist = point(
    "centreWaist",
    "CF waist corner",
    flip(rawB).x,
    flip(rawB).y,
    "PatternLab B",
    [],
  );

  draft.resolved.bustDepth = bustDepth;
  draft.resolved.centerFrontLength = centerFrontLength;
  draft.resolved.acrossChestWidth = acrossChestWidth;
  draft.calc.neckWidth = neckWidth;
  draft.calc.armholeEase = armholeEase;
  draft.calc.armholeDepth = armholeDepth;
  draft.front = {
    centreNeck,
    neckPoint,
    shoulderPoint,
    bustPoint,
    acrossChestPoint,
    underarm,
    dartLegBase,
    dartLegApex,
    sideExtOuter,
    waistSide,
    centreWaist,
  };

  // Bust dart intake, from the bust-to-waist differential (stands in for cup
  // size when cup is not measured) — kept from the previous method, since
  // PatternLab's dart is a fixed weld (P/J1 legs) rather than a
  // separately-sized dart; this ratio informs the reported intake only.
  const differential = Math.max(bust - waist, 0);
  const bustDartIntake = clamp(differential * 0.42, 2, 10);
  draft.bustDart = openDart(bustPoint, underarm, bustDartIntake, -1);
  draft.calc.bustDartIntake = draft.bustDart.intake;

  draft.waistDart = { x: bustPoint.x, intake: 0, height: 0 };
}

// ── Back — ported from PatternLab's computeBackBodicePoints ───────────────────

function draftBack(
  m: Measurements,
  draft: BodiceDraft,
  bust: number,
  waist: number,
  shoulderWidth: number,
  shoulderLen: number,
  shoulderDrop: number,
  backBodiceLength: number,
  sideSeamLength: number,
  opts: BlockOptions,
  estimates: Estimate[],
): void {
  const centerBackLength = resolve(
    m.centerBackLength,
    () => Math.max(backBodiceLength - BODICE.centerBackLengthOffset, 1),
    "centerBackLength",
    "back bodice length − 0.5in (source script's own documented relationship)",
    estimates,
  );

  const hasShoulderDart = opts.bodiceShoulderDart ?? true;
  const hasSwayback = opts.bodiceSwayback ?? true;

  const A = { x: 0, y: 0 };
  const rawB = { x: A.x, y: A.y - backBodiceLength };
  const rawC = { x: rawB.x, y: rawB.y + centerBackLength };
  // D: top outer shoulder reference. PatternLab: `D = {A.x + shoulderWidth/2, A.y}`.
  const rawD = { x: A.x + shoulderWidth / 2, y: A.y };
  // E: true shoulder tip, dropped by shoulderDrop. PatternLab: `E = {D.x, D.y - shoulderDrop}`.
  const rawE = { x: rawD.x, y: rawD.y - shoulderDrop };

  // F: side-neck point, via Pythagoras from the shoulder seam length and E's
  // drop. PatternLab: `dyF = |A.y - E.y|`, `dxF = shortSide(shoulderLength, dyF)`.
  const dyF = Math.abs(A.y - rawE.y);
  const dxF = shortSide(shoulderLen, dyF);
  const rawF = { x: rawE.x - dxF, y: A.y };

  const acrossBackWidth = m.acrossBackWidth;
  // Across-back half width: provided branch adds ease; fallback subtracts it
  // from half the shoulder width. PatternLab: `acrossBackHalfWidth()`.
  const acrossBackHalf =
    acrossBackWidth !== undefined
      ? acrossBackWidth / 2 + BODICE.acrossBackEase
      : shoulderWidth / 2 - BODICE.acrossBackEase;
  if (acrossBackWidth === undefined) {
    estimates.push({
      field: "acrossBackWidth",
      value: (acrossBackHalf - BODICE.acrossBackEase) * 2,
      from: "shoulder ÷ 2 − 0.25in ease (source script's own fallback formula)",
    });
  }

  // Shoulder dart (optional): E1 is E nudged along the shoulder-line
  // direction; P/P1/P2 sit at the dart's base and legs.
  let rawE1 = rawE;
  let rawP = { x: 0, y: 0 };
  let rawP1 = { x: 0, y: 0 };
  let rawP2 = { x: 0, y: 0 };
  let rawQ = { x: 0, y: 0 };
  if (hasShoulderDart) {
    const angleFE = angleBetween(rawF, rawE);
    rawE1 = pointAtAngle(rawE, angleFE, BODICE.backShoulderDartOffset);
    rawP = { x: (rawF.x + rawE1.x) / 2, y: (rawF.y + rawE1.y) / 2 };
    rawP1 = pointAtAngle(rawP, angleFE, -BODICE.backShoulderDartHalfWidth);
    rawP2 = pointAtAngle(rawP, angleFE, BODICE.backShoulderDartHalfWidth);
  }

  // Swayback (optional): contours the centre-back waist point.
  let rawBActive = rawB;
  let cbAngle = -Math.PI / 2; // straight down the CB line by default
  if (hasSwayback) {
    const rawB1 = { x: rawB.x + BODICE.swaybackOffset, y: rawB.y };
    cbAngle = angleBetween(rawC, rawB1);
    rawBActive = pointAtAngle(rawC, cbAngle, centerBackLength);
  }

  const dartPlacement =
    draft.resolved.bustPointSep / 2 - BODICE.dartPlacementOffset;

  let rawG: { x: number; y: number };
  let rawH: { x: number; y: number };
  let rawI: { x: number; y: number };
  let rawJ: { x: number; y: number };
  let rawG1: { x: number; y: number };

  if (!hasSwayback) {
    rawG = { x: rawBActive.x + dartPlacement, y: rawBActive.y };
    rawH = { x: rawG.x + BODICE.backWaistDartWidth, y: rawG.y };
    rawI = { x: (rawG.x + rawH.x) / 2, y: rawG.y };
    rawJ = {
      x: rawI.x,
      y: rawI.y + (sideSeamLength - BODICE.backWaistDartWidth),
    };
    rawG1 = { x: rawG.x, y: rawG.y };
  } else {
    const waistAngle = cbAngle + Math.PI / 2;
    rawG = pointAtAngle(rawBActive, waistAngle, dartPlacement);
    rawH = pointAtAngle(rawG, waistAngle, BODICE.backWaistDartWidth);
    rawI = { x: (rawG.x + rawH.x) / 2, y: (rawG.y + rawH.y) / 2 };
    rawJ = pointAtAngle(
      rawI,
      cbAngle,
      -(sideSeamLength - BODICE.backWaistDartWidth),
    );
    const jhLength = distance(rawH, rawJ);
    const angleJG = angleBetween(rawJ, rawG);
    rawG1 = pointAtAngle(rawJ, angleJG, jhLength);
  }

  if (hasShoulderDart) {
    const anglePJ = angleBetween(rawP, rawJ);
    const qDistance = sideSeamLength / 3 + BODICE.backShoulderDartQOffset;
    rawQ = pointAtAngle(rawP, anglePJ, qDistance);
  }

  let rawK: { x: number; y: number };
  if (!hasSwayback) {
    const remainingWaist = waist / 4 - dartPlacement;
    rawK = { x: rawH.x + remainingWaist, y: rawH.y };
  } else {
    rawK = {
      x: rawBActive.x + (waist / 4 + BODICE.backWaistSideSwaybackOffset),
      y: rawB.y,
    };
  }

  const rawL = { x: rawK.x, y: rawK.y + sideSeamLength };
  let rawM = { x: A.x, y: rawL.y };
  if (hasSwayback) {
    rawM = {
      x: rawC.x + Math.abs(rawL.y - rawC.y) / Math.tan(Math.abs(cbAngle)),
      y: rawL.y,
    };
  }

  const rawN = { x: rawM.x + bust / 4, y: rawM.y };
  const angleKN = angleBetween(rawK, rawN);
  const rawO = pointAtAngle(rawK, angleKN, sideSeamLength);

  const midCMY = (rawC.y + rawM.y) / 2;
  const rawR = { x: A.x + acrossBackHalf, y: midCMY };

  const flip = (p: { x: number; y: number }) => ({ x: -p.x, y: -p.y });

  const centreNeck = point(
    "centreNeck",
    "Nape",
    flip(rawC).x,
    flip(rawC).y,
    "PatternLab C",
    ["chest"],
  );
  const neckPoint = point(
    "neckPoint",
    "Side neck point",
    flip(rawF).x,
    flip(rawF).y,
    "PatternLab F",
    ["shoulder"],
  );
  const shoulderPoint = point(
    "shoulderPoint",
    "Shoulder tip",
    flip(rawE1).x,
    flip(rawE1).y,
    hasShoulderDart ? "PatternLab E1" : "PatternLab E",
    ["shoulder"],
  );
  const acrossBackPoint = point(
    "acrossBackPoint",
    "Across back",
    flip(rawR).x,
    flip(rawR).y,
    "PatternLab R",
    ["acrossBackWidth"],
  );
  const underarm = point(
    "underarm",
    "Underarm",
    flip(rawO).x,
    flip(rawO).y,
    "PatternLab O",
    ["chest"],
  );
  const waistSideTop = point(
    "waistSideTop",
    "Side seam, underarm level",
    flip(rawK).x,
    flip(rawK).y,
    "PatternLab K",
    ["waist"],
  );
  const sideSeamBase = point(
    "sideSeamBase",
    "Waist dart, side leg",
    flip(rawH).x,
    flip(rawH).y,
    "PatternLab H",
    [],
  );
  const waistDartLeg = point(
    "waistDartLeg",
    "Waist dart, centre leg",
    flip(rawJ).x,
    flip(rawJ).y,
    "PatternLab J",
    [],
  );
  const waistDartFoot = point(
    "waistDartFoot",
    "Waist dart foot",
    flip(rawG1).x,
    flip(rawG1).y,
    "PatternLab G1",
    [],
  );
  const centreWaist = point(
    "centreWaist",
    "CB waist",
    flip(rawBActive).x,
    flip(rawBActive).y,
    "PatternLab B/BActive",
    [],
  );

  draft.resolved.centerBackLength = centerBackLength;
  draft.resolved.acrossBackWidth =
    acrossBackWidth ?? (acrossBackHalf - BODICE.acrossBackEase) * 2;
  draft.back = {
    centreNeck,
    neckPoint,
    shoulderPoint,
    acrossBackPoint,
    underarm,
    waistSideTop,
    sideSeamBase,
    waistDartLeg,
    waistDartFoot,
    centreWaist,
  };

  if (hasShoulderDart) {
    const apex = point(
      "shoulderDartApex",
      "Shoulder dart apex",
      flip(rawP).x,
      flip(rawP).y,
      "PatternLab P",
      [],
    );
    const legStart = point(
      "shoulderDartLegStart",
      "Shoulder dart leg (P1)",
      flip(rawP1).x,
      flip(rawP1).y,
      "PatternLab P1",
      [],
    );
    const legEnd = point(
      "shoulderDartLegEnd",
      "Shoulder dart leg (P2)",
      flip(rawP2).x,
      flip(rawP2).y,
      "PatternLab P2",
      [],
    );
    draft.shoulderDart = {
      apex,
      legStart,
      legEnd,
      intake: distance(rawP1, rawP2),
      angle: 0,
      legLength: distance(rawP, rawP1),
    };
    draft.calc.shoulderDartIntake = draft.shoulderDart.intake;
    // Q is the dart's throat point, drawn into the outline separately (see
    // bodice-geometry.ts) — stash it as a fourth "leg" via the dart's apex
    // sibling so geometry can reach it without a new public type.
    (draft.shoulderDart as unknown as { throat: DraftPoint }).throat = point(
      "shoulderDartThroat",
      "Shoulder dart throat (Q)",
      flip(rawQ).x,
      flip(rawQ).y,
      "PatternLab Q",
      [],
    );
  }

  draft.waistDart = {
    x: waistDartLeg.x,
    intake: distance(rawG, rawH),
    height: 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Pythagoras — the other leg of a right triangle given the hypotenuse and one
 * leg. Deliberately NOT clamped to zero when `leg > hypotenuse` (unlike a
 * defensive version might be): PatternLab's own `shortSide()` returns NaN in
 * that case, and its neck-width fallback (`Number.isNaN(neckWidth) ||
 * neckWidth <= 0`) relies on exactly that signal to detect an impossible
 * triangle. Clamping here would silently skip that fallback.
 */
function shortSide(hypotenuse: number, leg: number): number {
  return Math.sqrt(hypotenuse * hypotenuse - leg * leg);
}

/**
 * PatternLab's tiered-ease pattern: the first tier whose threshold the value
 * meets or exceeds, else the default. Tiers must be sorted highest-first.
 * The epsilon guards against a tier boundary computed via a different
 * floating-point path than the threshold itself landing a hair below it
 * (e.g. a `deltaL` computed as `frontBodiceLength - backBodiceLength` can
 * land a hair off an exact tier threshold like `3.0` due to how the two
 * lengths were themselves derived) — PatternLab's own script never hits this
 * because its comparison and its threshold are both plain literals.
 */
function tieredEase(
  value: number,
  tiers: readonly { minBust: number; ease: number }[],
  fallback: number,
): number {
  const EPSILON = 1e-9;
  for (const tier of tiers) {
    if (value >= tier.minBust - EPSILON) return tier.ease;
  }
  return fallback;
}

/** Placeholder while side seam is threaded through — replaced by the real
 *  resolved value once both panels share one signature (see call sites). */
function draftSideSeam(draft: BodiceDraft): number {
  return draft.resolved.sideSeamLength;
}

/** Uses a measured value, or derives one and records that it was estimated. */
function resolve(
  measured: number | undefined,
  derive: () => number,
  field: keyof Measurements,
  formula: string,
  estimates: Estimate[],
): number {
  if (measured !== undefined && Number.isFinite(measured) && measured > 0)
    return measured;
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
  estimates: Estimate[],
): number {
  if (measured !== undefined && Number.isFinite(measured) && measured > 0)
    return measured;
  if (height !== undefined && Number.isFinite(height) && height > 0) {
    const value = height * ratio;
    estimates.push({ field, value, from: `height × ${ratio}` });
    return value;
  }
  estimates.push({ field, value: fallback, from: "standard block length" });
  return fallback;
}
