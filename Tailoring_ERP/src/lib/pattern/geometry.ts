/**
 * Geometry primitives: a fluent SVG path builder, and bounds computed from real
 * geometry rather than estimated.
 *
 * `PathBuilder` replaces hand-concatenated `d` strings. The old approach made a
 * missing space or a transposed control point easy to introduce and invisible
 * until it rendered wrong.
 *
 * `boundsOf` flattens curves and measures what was actually drawn, so a viewBox
 * always contains its contents. Estimating the width from the widest formula was
 * how earlier drafts ended up clipped.
 */

import { RENDER } from "./constants.ts";
import type { Bounds, Point } from "./types.ts";

// ── Path builder ──────────────────────────────────────────────────────────────

/** Rounds to 3dp to keep `d` strings short without visible loss of precision. */
function r(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export class PathBuilder {
  private readonly parts: string[] = [];
  private current: Point | null = null;
  private start: Point | null = null;

  moveTo(x: number, y: number): this {
    this.parts.push(`M ${r(x)} ${r(y)}`);
    this.current = { x, y };
    this.start = { x, y };
    return this;
  }

  moveToPoint(p: Point): this {
    return this.moveTo(p.x, p.y);
  }

  lineTo(x: number, y: number): this {
    this.parts.push(`L ${r(x)} ${r(y)}`);
    this.current = { x, y };
    return this;
  }

  lineToPoint(p: Point): this {
    return this.lineTo(p.x, p.y);
  }

  /** Quadratic Bézier: one control point. */
  quadTo(cpx: number, cpy: number, x: number, y: number): this {
    this.parts.push(`Q ${r(cpx)} ${r(cpy)} ${r(x)} ${r(y)}`);
    this.current = { x, y };
    return this;
  }

  /** Cubic Bézier: two control points. Needed for S-shaped curves like armholes. */
  cubicTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): this {
    this.parts.push(
      `C ${r(cp1x)} ${r(cp1y)} ${r(cp2x)} ${r(cp2y)} ${r(x)} ${r(y)}`,
    );
    this.current = { x, y };
    return this;
  }

  /** Appends a pre-built segment (without its leading moveTo). */
  append(segment: string): this {
    this.parts.push(segment.trim());
    return this;
  }

  close(): this {
    this.parts.push("Z");
    if (this.start) this.current = { ...this.start };
    return this;
  }

  /** Where the pen currently sits, for chaining a segment from here. */
  position(): Point | null {
    return this.current ? { ...this.current } : null;
  }

  toString(): string {
    return this.parts.join(" ");
  }
}

export function path(): PathBuilder {
  return new PathBuilder();
}

// ── Curve helpers ─────────────────────────────────────────────────────────────

function quadPoint(t: number, p0: number, cp: number, p1: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * cp + t * t * p1;
}

function cubicPoint(
  t: number,
  p0: number,
  cp1: number,
  cp2: number,
  p1: number,
): number {
  const mt = 1 - t;
  return (
    mt ** 3 * p0 + 3 * mt ** 2 * t * cp1 + 3 * mt * t ** 2 * cp2 + t ** 3 * p1
  );
}

// ── Bounds ────────────────────────────────────────────────────────────────────

type Extent = { minX: number; minY: number; maxX: number; maxY: number };

const EMPTY: Extent = {
  minX: Number.POSITIVE_INFINITY,
  minY: Number.POSITIVE_INFINITY,
  maxX: Number.NEGATIVE_INFINITY,
  maxY: Number.NEGATIVE_INFINITY,
};

function extend(e: Extent, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < e.minX) e.minX = x;
  if (y < e.minY) e.minY = y;
  if (x > e.maxX) e.maxX = x;
  if (y > e.maxY) e.maxY = y;
}

/**
 * Walks a `d` string and records the true extent of the drawn curve.
 *
 * Curves are flattened rather than bounded by their control points: a Bézier
 * stays inside its control hull but rarely reaches it, and using the hull would
 * pad every viewBox with empty space.
 */
function accumulate(d: string, e: Extent): void {
  const parts = d.trim().split(/(?=[MLQCZmlqcz])/);
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  for (const part of parts) {
    const letter = part[0]?.toUpperCase();
    if (!letter) continue;
    const n = part
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (letter === "M" && n.length >= 2) {
      cx = n[0];
      cy = n[1];
      sx = cx;
      sy = cy;
      extend(e, cx, cy);
    } else if (letter === "L" && n.length >= 2) {
      cx = n[0];
      cy = n[1];
      extend(e, cx, cy);
    } else if (letter === "Q" && n.length >= 4) {
      for (let i = 0; i <= RENDER.flattenSteps; i++) {
        const t = i / RENDER.flattenSteps;
        extend(e, quadPoint(t, cx, n[0], n[2]), quadPoint(t, cy, n[1], n[3]));
      }
      cx = n[2];
      cy = n[3];
    } else if (letter === "C" && n.length >= 6) {
      for (let i = 0; i <= RENDER.flattenSteps; i++) {
        const t = i / RENDER.flattenSteps;
        extend(
          e,
          cubicPoint(t, cx, n[0], n[2], n[4]),
          cubicPoint(t, cy, n[1], n[3], n[5]),
        );
      }
      cx = n[4];
      cy = n[5];
    } else if (letter === "Z") {
      cx = sx;
      cy = sy;
    }
  }
}

/**
 * The bounding box of a set of paths, padded.
 *
 * Falls back to a small placeholder box when there is nothing to measure, so a
 * caller never has to handle an infinite or zero-area viewBox.
 */
export function boundsOf(
  ds: readonly string[],
  padding = RENDER.viewBoxPadding,
): Bounds {
  const e: Extent = { ...EMPTY };
  for (const d of ds) accumulate(d, e);

  if (!Number.isFinite(e.minX) || !Number.isFinite(e.minY)) {
    return {
      x: -padding,
      y: -padding,
      w: 30 + padding * 2,
      h: 40 + padding * 2,
    };
  }

  return {
    x: e.minX - padding,
    y: e.minY - padding,
    w: Math.max(e.maxX - e.minX, 0.1) + padding * 2,
    h: Math.max(e.maxY - e.minY, 0.1) + padding * 2,
  };
}
