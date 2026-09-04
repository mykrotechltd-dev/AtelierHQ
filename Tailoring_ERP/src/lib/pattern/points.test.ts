import { describe, expect, it } from "vitest";
import {
  alongBy,
  distance,
  openDart,
  pointAtSlope,
  rotateAround,
} from "@/lib/pattern/points.ts";

describe("distance", () => {
  it("measures a 3-4-5 triangle", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is zero for coincident points", () => {
    expect(distance({ x: 2, y: 7 }, { x: 2, y: 7 })).toBe(0);
  });
});

describe("rotateAround", () => {
  it("rotates a quarter turn about the origin", () => {
    const p = rotateAround({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(1, 10);
  });

  it("leaves the pivot itself fixed", () => {
    const pivot = { x: 5, y: 9 };
    const p = rotateAround(pivot, pivot, 1.2);
    expect(p.x).toBeCloseTo(5, 10);
    expect(p.y).toBeCloseTo(9, 10);
  });

  it("preserves distance from the pivot", () => {
    const pivot = { x: 3, y: 3 };
    const start = { x: 3, y: 11 };
    const rotated = rotateAround(start, pivot, 0.7);
    expect(distance(pivot, rotated)).toBeCloseTo(distance(pivot, start), 10);
  });
});

describe("pointAtSlope", () => {
  it("solves the horizontal run by Pythagoras", () => {
    // shoulder length 5, drop 3 => run must be 4
    const p = pointAtSlope({ x: 0, y: 0 }, 5, 3);
    expect(p.x).toBeCloseTo(4, 10);
    expect(p.y).toBeCloseTo(3, 10);
  });

  it("keeps the seam length exactly as measured", () => {
    const from = { x: 6.5, y: 1.4 };
    const p = pointAtSlope(from, 13.2, 4.5);
    expect(distance(from, p)).toBeCloseTo(13.2, 10);
  });

  it("mirrors for a left-facing panel", () => {
    const p = pointAtSlope({ x: 0, y: 0 }, 5, 3, -1);
    expect(p.x).toBeCloseTo(-4, 10);
    expect(p.y).toBeCloseTo(3, 10);
  });

  it("degrades to straight down when the drop exceeds the length", () => {
    // Impossible triangle: cannot drop 10 over a 5cm seam.
    const p = pointAtSlope({ x: 0, y: 0 }, 5, 10);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(5, 10);
  });
});

describe("alongBy", () => {
  it("walks a given distance toward the target", () => {
    const p = alongBy({ x: 0, y: 0 }, { x: 10, y: 0 }, 2.5);
    expect(p.x).toBeCloseTo(2.5, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it("returns the origin when both points coincide", () => {
    const p = alongBy({ x: 4, y: 4 }, { x: 4, y: 4 }, 3);
    expect(p).toEqual({ x: 4, y: 4 });
  });
});

describe("openDart", () => {
  it("opens the requested intake between the leg ends", () => {
    const apex = { x: 0, y: 0 };
    const leg = { x: 0, y: 12 };
    const dart = openDart(apex, leg, 9);
    // The whole point of the law-of-cosines solve: the gap equals the intake.
    expect(distance(dart.legStart, dart.legEnd)).toBeCloseTo(9, 6);
  });

  it("keeps both legs the same length as the original", () => {
    const apex = { x: 2, y: 3 };
    const leg = { x: 14, y: 9 };
    const dart = openDart(apex, leg, 7);
    expect(distance(apex, dart.legStart)).toBeCloseTo(dart.legLength, 10);
    expect(distance(apex, dart.legEnd)).toBeCloseTo(dart.legLength, 10);
  });

  it("scales the angle with the intake", () => {
    const apex = { x: 0, y: 0 };
    const leg = { x: 0, y: 12 };
    const small = openDart(apex, leg, 4);
    const large = openDart(apex, leg, 10);
    expect(Math.abs(large.angle)).toBeGreaterThan(Math.abs(small.angle));
  });

  it("produces no dart for a zero or negative intake", () => {
    const apex = { x: 0, y: 0 };
    const leg = { x: 0, y: 12 };
    expect(openDart(apex, leg, 0).intake).toBe(0);
    expect(openDart(apex, leg, -5).intake).toBe(0);
    expect(openDart(apex, leg, 0).legEnd).toEqual(leg);
  });

  it("clamps an intake wider than the legs can open", () => {
    const apex = { x: 0, y: 0 };
    const leg = { x: 0, y: 6 };
    // Legs of 6cm cannot open more than 12cm (a straight line).
    const dart = openDart(apex, leg, 99);
    expect(Number.isFinite(dart.angle)).toBe(true);
    expect(dart.intake).toBeLessThanOrEqual(12);
    expect(distance(dart.legStart, dart.legEnd)).toBeLessThanOrEqual(12.0001);
  });

  it("never returns NaN for a degenerate leg", () => {
    const apex = { x: 4, y: 4 };
    const dart = openDart(apex, apex, 8);
    expect(Number.isFinite(dart.angle)).toBe(true);
    expect(dart.intake).toBe(0);
  });

  it("mirrors direction for the opposite panel", () => {
    const apex = { x: 0, y: 0 };
    const leg = { x: 0, y: 12 };
    const right = openDart(apex, leg, 8, 1);
    const left = openDart(apex, leg, 8, -1);
    expect(right.angle).toBeCloseTo(-left.angle, 10);
    expect(right.legEnd.x).toBeCloseTo(-left.legEnd.x, 10);
  });
});
