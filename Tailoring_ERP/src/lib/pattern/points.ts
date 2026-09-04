/**
 * Named drafting points, and the trigonometry the draft needs.
 *
 * Every point carries the formula that produced it and what it depends on, so
 * the UI can explain why a point sits where it does, and a future grading step
 * can recompute a subset when one measurement changes.
 *
 * The bust dart rotation is the only step that needs real trigonometry. It is
 * isolated here and unit tested, because it is the highest-risk arithmetic in
 * the engine.
 */

import type { MeasurementKey, Point } from "./types.ts";

// ── Named points ──────────────────────────────────────────────────────────────

/**
 * A drafting point with its provenance.
 *
 * `formula` is a readable description, not executable — the calculation lives in
 * the calculator. It exists so a tailor can audit the draft.
 */
export type DraftPoint = Point & {
  id: string;
  label: string;
  formula: string;
  dependsOn: readonly (MeasurementKey | string)[];
};

export function point(
  id: string,
  label: string,
  x: number,
  y: number,
  formula: string,
  dependsOn: readonly (MeasurementKey | string)[] = []
): DraftPoint {
  return { id, label, x, y, formula, dependsOn };
}

/** A keyed collection of the points making up one pattern piece. */
export type PointSet = Record<string, DraftPoint>;

// ── Vector helpers ────────────────────────────────────────────────────────────

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Rotates `p` around `origin` by `angle` radians. Positive is clockwise in
 *  screen coordinates, where y increases downward. */
export function rotateAround(p: Point, origin: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** The point `t` of the way from `a` to `b`. */
export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Moves from `from` toward `to`, but stopping at `length`.
 * Returns `from` unchanged when the two points coincide.
 */
export function alongBy(from: Point, to: Point, length: number): Point {
  const d = distance(from, to);
  if (d === 0) return { ...from };
  return lerp(from, to, length / d);
}

/**
 * A point at `length` from `from`, dropping exactly `drop` vertically.
 *
 * This is the shoulder-slope construction: the shoulder length is a measured
 * distance along the seam, and the slope is a vertical drop, so the horizontal
 * component follows from Pythagoras.
 *
 * When `drop` exceeds `length` the triangle is impossible; the point is placed
 * straight down at `length` so the draft stays drawable.
 */
export function pointAtSlope(
  from: Point,
  length: number,
  drop: number,
  direction: 1 | -1 = 1
): Point {
  const clampedDrop = Math.min(Math.abs(drop), length);
  const dx = Math.sqrt(Math.max(length * length - clampedDrop * clampedDrop, 0));
  return { x: from.x + dx * direction, y: from.y + clampedDrop };
}

// ── Bust dart rotation ────────────────────────────────────────────────────────

export type BustDart = {
  /** The pivot. Both legs radiate from here. */
  apex: Point;
  /** Leg the dart opens from (the original seam line). */
  legStart: Point;
  /** Leg the dart opens to, after rotation. */
  legEnd: Point;
  /** Straight-line opening between the leg ends (cm). */
  intake: number;
  /** Rotation applied, in radians. */
  angle: number;
  /** Length of each leg from the apex (cm). */
  legLength: number;
};

/**
 * Opens a dart of `intake` cm around `apex`, starting from the leg through
 * `legPoint`.
 *
 * Solved with the law of cosines: with two legs of known equal length `L` and a
 * desired opening `c` between their ends,
 *
 *     c² = L² + L² − 2·L·L·cos θ    ⟹    θ = arccos(1 − c² / 2L²)
 *
 * The intake is clamped to what the leg length can physically open to (the legs
 * cannot open beyond a straight line, i.e. `c ≤ 2L`), so an over-large requested
 * intake yields the widest valid dart instead of `NaN`.
 */
export function openDart(
  apex: Point,
  legPoint: Point,
  intake: number,
  direction: 1 | -1 = 1
): BustDart {
  const legLength = distance(apex, legPoint);

  if (legLength === 0 || intake <= 0) {
    return {
      apex,
      legStart: { ...legPoint },
      legEnd: { ...legPoint },
      intake: 0,
      angle: 0,
      legLength,
    };
  }

  // Legs cannot open past a straight line.
  const maxIntake = 2 * legLength;
  const usable = Math.min(intake, maxIntake);

  const cosTheta = 1 - (usable * usable) / (2 * legLength * legLength);
  // Guard against floating point pushing us just outside arccos's domain.
  const angle = Math.acos(Math.min(1, Math.max(-1, cosTheta))) * direction;

  return {
    apex,
    legStart: { ...legPoint },
    legEnd: rotateAround(legPoint, apex, angle),
    intake: usable,
    angle,
    legLength,
  };
}
