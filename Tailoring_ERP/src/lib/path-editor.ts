/**
 * Path Editor Utilities
 *
 * Parses SVG path `d` strings into editable command objects and serialises
 * them back. Supports M, L, Q, C, Z — the full set used by pattern-engine.ts.
 *
 * Coordinates are in inches (matching the pattern engine's viewBox).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type MCmd = { type: "M"; x: number; y: number };
export type LCmd = { type: "L"; x: number; y: number };
export type QCmd = {
  type: "Q";
  cpx: number;
  cpy: number;
  x: number;
  y: number;
};
export type CCmd = {
  type: "C";
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
};
export type ZCmd = { type: "Z" };

export type PathCmd = MCmd | LCmd | QCmd | CCmd | ZCmd;

/** A parsed, editable path */
export type EditablePath = PathCmd[];

// ── Parser ────────────────────────────────────────────────────────────────────

function nums(str: string): number[] {
  return str
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
}

export function parsePath(d: string): EditablePath {
  const cmds: EditablePath = [];
  // Split on command letters, keeping the letter attached
  const parts = d.trim().split(/(?=[MLQCZmlqcz])/);

  for (const part of parts) {
    const letter = part[0];
    const upper = letter.toUpperCase();
    const n = nums(part.slice(1));

    if (upper === "M") cmds.push({ type: "M", x: n[0], y: n[1] });
    else if (upper === "L") cmds.push({ type: "L", x: n[0], y: n[1] });
    else if (upper === "Q")
      cmds.push({ type: "Q", cpx: n[0], cpy: n[1], x: n[2], y: n[3] });
    else if (upper === "C")
      cmds.push({
        type: "C",
        cp1x: n[0],
        cp1y: n[1],
        cp2x: n[2],
        cp2y: n[3],
        x: n[4],
        y: n[5],
      });
    else if (upper === "Z") cmds.push({ type: "Z" });
  }
  return cmds;
}

// ── Serialiser ────────────────────────────────────────────────────────────────

function r(n: number) {
  return Math.round(n * 1000) / 1000; // 3 decimal places
}

export function serialisePath(cmds: EditablePath): string {
  return cmds
    .map((cmd) => {
      if (cmd.type === "M") return `M ${r(cmd.x)} ${r(cmd.y)}`;
      if (cmd.type === "L") return `L ${r(cmd.x)} ${r(cmd.y)}`;
      if (cmd.type === "Q")
        return `Q ${r(cmd.cpx)} ${r(cmd.cpy)} ${r(cmd.x)} ${r(cmd.y)}`;
      if (cmd.type === "C")
        return `C ${r(cmd.cp1x)} ${r(cmd.cp1y)} ${r(cmd.cp2x)} ${r(cmd.cp2y)} ${r(cmd.x)} ${r(cmd.y)}`;
      return "Z";
    })
    .join(" ");
}

// ── Point extraction ──────────────────────────────────────────────────────────

/** Identifies every draggable handle in a parsed path */
export type PointRole = "anchor" | "cp" | "cp1" | "cp2";

export type EditPoint = {
  id: string; // unique key: `{cmdIdx}-{role}`
  cmdIdx: number;
  role: PointRole;
  x: number;
  y: number;
};

export function extractPoints(cmds: EditablePath): EditPoint[] {
  const points: EditPoint[] = [];
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    if (cmd.type === "Z") continue;
    if (cmd.type === "M" || cmd.type === "L") {
      points.push({
        id: `${i}-anchor`,
        cmdIdx: i,
        role: "anchor",
        x: cmd.x,
        y: cmd.y,
      });
    } else if (cmd.type === "Q") {
      points.push({
        id: `${i}-cp`,
        cmdIdx: i,
        role: "cp",
        x: cmd.cpx,
        y: cmd.cpy,
      });
      points.push({
        id: `${i}-anchor`,
        cmdIdx: i,
        role: "anchor",
        x: cmd.x,
        y: cmd.y,
      });
    } else if (cmd.type === "C") {
      points.push({
        id: `${i}-cp1`,
        cmdIdx: i,
        role: "cp1",
        x: cmd.cp1x,
        y: cmd.cp1y,
      });
      points.push({
        id: `${i}-cp2`,
        cmdIdx: i,
        role: "cp2",
        x: cmd.cp2x,
        y: cmd.cp2y,
      });
      points.push({
        id: `${i}-anchor`,
        cmdIdx: i,
        role: "anchor",
        x: cmd.x,
        y: cmd.y,
      });
    }
  }
  return points;
}

/** Apply a moved point back into the command list, returning new commands */
export function applyPointMove(
  cmds: EditablePath,
  cmdIdx: number,
  role: PointRole,
  nx: number,
  ny: number,
): EditablePath {
  return cmds.map((cmd, i): PathCmd => {
    if (i !== cmdIdx) return cmd;
    if (role === "anchor") {
      if (cmd.type === "M") return { ...cmd, x: nx, y: ny };
      if (cmd.type === "L") return { ...cmd, x: nx, y: ny };
      if (cmd.type === "Q") return { ...cmd, x: nx, y: ny };
      if (cmd.type === "C") return { ...cmd, x: nx, y: ny };
    }
    if (role === "cp" && cmd.type === "Q") return { ...cmd, cpx: nx, cpy: ny };
    if (role === "cp1" && cmd.type === "C")
      return { ...cmd, cp1x: nx, cp1y: ny };
    if (role === "cp2" && cmd.type === "C")
      return { ...cmd, cp2x: nx, cp2y: ny };
    return cmd;
  });
}

/** Get the previous anchor position (needed to draw tangent lines) */
export function prevAnchor(
  cmds: EditablePath,
  cmdIdx: number,
): { x: number; y: number } | null {
  for (let i = cmdIdx - 1; i >= 0; i--) {
    const c = cmds[i];
    if (c.type === "M" || c.type === "L") return { x: c.x, y: c.y };
    if (c.type === "Q" || c.type === "C") return { x: c.x, y: c.y };
  }
  return null;
}
