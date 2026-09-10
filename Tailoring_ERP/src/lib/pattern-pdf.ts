/**
 * AtelierHQ Pattern PDF Generator
 * Renders PatternBlock objects to a jsPDF document, one block per page.
 * Blocks are scaled to fit an A4 page with a clear scale ratio label.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PatternBlock, PatternPath } from "./pattern-engine.ts";

// Brand colours (R, G, B)
const NAVY: [number, number, number] = [28, 40, 80];
const GOLD: [number, number, number] = [180, 140, 60];
const GRAY: [number, number, number] = [100, 100, 100];
const LIGHT: [number, number, number] = [240, 237, 228];

// A4 usable area (mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const DRAW_W = PAGE_W - MARGIN * 2; // 180 mm
const DRAW_H = PAGE_H - MARGIN * 2 - 30; // leave 30mm for header

// ── SVG path parser ───────────────────────────────────────────────────────────

type Cmd =
  | { t: "M"; x: number; y: number }
  | { t: "L"; x: number; y: number }
  | { t: "Q"; cpx: number; cpy: number; x: number; y: number }
  | {
      t: "C";
      cp1x: number;
      cp1y: number;
      cp2x: number;
      cp2y: number;
      x: number;
      y: number;
    }
  | { t: "Z" };

function parsePath(d: string): Cmd[] {
  const cmds: Cmd[] = [];
  // Tokenise: split on command letters, keeping the letter
  const parts = d.trim().split(/(?=[MLQCZmlqcz])/);
  for (const part of parts) {
    const letter = part[0].toUpperCase();
    const nums = part
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (letter === "M") cmds.push({ t: "M", x: nums[0], y: nums[1] });
    else if (letter === "L") cmds.push({ t: "L", x: nums[0], y: nums[1] });
    else if (letter === "Q")
      cmds.push({ t: "Q", cpx: nums[0], cpy: nums[1], x: nums[2], y: nums[3] });
    else if (letter === "C")
      cmds.push({
        t: "C",
        cp1x: nums[0],
        cp1y: nums[1],
        cp2x: nums[2],
        cp2y: nums[3],
        x: nums[4],
        y: nums[5],
      });
    else if (letter === "Z") cmds.push({ t: "Z" });
  }
  return cmds;
}

/** Approximate a quadratic bezier as a polyline (for jsPDF compatibility) */
function qBezierPoints(
  x0: number,
  y0: number,
  cpx: number,
  cpy: number,
  x1: number,
  y1: number,
  steps = 12,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cpx + t ** 2 * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cpy + t ** 2 * y1;
    pts.push([x, y]);
  }
  return pts;
}

/** Approximate a cubic bezier as a polyline (for jsPDF compatibility) */
function cBezierPoints(
  x0: number,
  y0: number,
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  x1: number,
  y1: number,
  steps = 18,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt ** 3 * x0 +
      3 * mt ** 2 * t * cp1x +
      3 * mt * t ** 2 * cp2x +
      t ** 3 * x1;
    const y =
      mt ** 3 * y0 +
      3 * mt ** 2 * t * cp1y +
      3 * mt * t ** 2 * cp2y +
      t ** 3 * y1;
    pts.push([x, y]);
  }
  return pts;
}

/** Convert SVG path d string to a flat list of [x,y] points (polyline approximation) */
function pathToPolyline(d: string): [number, number][] {
  const cmds = parsePath(d);
  const pts: [number, number][] = [];
  let cx = 0,
    cy = 0;
  let startX = 0,
    startY = 0;

  for (const cmd of cmds) {
    if (cmd.t === "M") {
      pts.push([cmd.x, cmd.y]);
      cx = cmd.x;
      cy = cmd.y;
      startX = cx;
      startY = cy;
    } else if (cmd.t === "L") {
      pts.push([cmd.x, cmd.y]);
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.t === "Q") {
      const curve = qBezierPoints(cx, cy, cmd.cpx, cmd.cpy, cmd.x, cmd.y);
      pts.push(...curve.slice(1)); // skip first (already in pts)
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.t === "C") {
      const curve = cBezierPoints(
        cx,
        cy,
        cmd.cp1x,
        cmd.cp1y,
        cmd.cp2x,
        cmd.cp2y,
        cmd.x,
        cmd.y,
      );
      pts.push(...curve.slice(1)); // skip first (already in pts)
      cx = cmd.x;
      cy = cmd.y;
    } else if (cmd.t === "Z") {
      pts.push([startX, startY]);
    }
  }
  return pts;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawPath(
  doc: jsPDF,
  path: PatternPath,
  ox: number, // origin x in mm on the page
  oy: number, // origin y in mm on the page
  scale: number, // in → mm factor
) {
  const pts = pathToPolyline(path.d);
  if (pts.length < 2) return;

  const tx = (x: number) => ox + x * scale;
  const ty = (y: number) => oy + y * scale;

  // Style
  doc.setDrawColor(...NAVY);
  switch (path.type) {
    case "outline":
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([], 0);
      break;
    case "dart":
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1.5, 1], 0);
      break;
    case "grainline":
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([], 0);
      break;
    case "construction":
      doc.setDrawColor(...GRAY);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([1, 1], 0);
      break;
    case "fold":
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.35);
      doc.setLineDashPattern([2, 1], 0);
      break;
  }

  // Draw as polyline via jsPDF lines()
  const relLines = pts
    .slice(1)
    .map(([x, y], i) => [tx(x) - tx(pts[i][0]), ty(y) - ty(pts[i][1])]);
  doc.lines(relLines, tx(pts[0][0]), ty(pts[0][1]), [1, 1], "S");

  // Grain line arrowheads
  if (path.type === "grainline" && pts.length >= 2) {
    const last = pts[pts.length - 1];
    const first = pts[0];
    // Small arrowhead at top
    doc.setLineDashPattern([], 0);
    const aw = 1.2;
    doc.lines(
      [
        [
          tx(first[0]) - aw - tx(first[0]),
          ty(first[1]) + aw * 1.5 - ty(first[1]),
        ],
        [aw * 2, 0],
      ],
      tx(first[0]) - aw,
      ty(first[1]) + aw * 1.5,
      [1, 1],
      "S",
    );
    // Small arrowhead at bottom
    doc.lines(
      [
        [tx(last[0]) - aw - tx(last[0]), ty(last[1]) - aw * 1.5 - ty(last[1])],
        [aw * 2, 0],
      ],
      tx(last[0]) - aw,
      ty(last[1]) - aw * 1.5,
      [1, 1],
      "S",
    );
  }

  // Reset
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
}

// ── Block page ────────────────────────────────────────────────────────────────

function addBlockPage(doc: jsPDF, block: PatternBlock) {
  doc.addPage();

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(block.name.toUpperCase(), MARGIN, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("AtelierHQ — Basic Draft", PAGE_W - MARGIN, 13, { align: "right" });

  // If block is missing measurements, show placeholder
  if (block.missingMeasurements.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(
      `Missing measurements: ${block.missingMeasurements.join(", ")}`,
      PAGE_W / 2,
      PAGE_H / 2,
      { align: "center" },
    );
    return;
  }

  // Calculate scale to fit block into draw area
  const vbWin = block.viewBox.w; // block width in inches
  const vbHin = block.viewBox.h; // block height in inches
  // 1 in = 25.4 mm at 1:1; we need to scale to fit DRAW_W × DRAW_H
  const scaleX = DRAW_W / (vbWin * 25.4); // mm/in after scale
  const scaleY = DRAW_H / (vbHin * 25.4);
  const fit = Math.min(scaleX, scaleY, 1); // never scale up past 1:1
  const mmPerIn = 25.4 * fit; // mm per inch in the drawing

  // Scale ratio label
  const ratio = Math.round((1 / fit) * 10) / 10; // e.g. 1:1.4
  const scaleStr = fit >= 0.99 ? "Scale: 1:1 (full size)" : `Scale: 1:${ratio}`;

  // Origin for drawing area (centred if block is smaller than draw area)
  const drawnW = vbWin * mmPerIn;
  const drawnH = vbHin * mmPerIn;
  const ox = MARGIN + (DRAW_W - drawnW) / 2 - block.viewBox.x * mmPerIn;
  const oy = MARGIN + 20 + (DRAW_H - drawnH) / 2 - block.viewBox.y * mmPerIn;

  // Background tint
  doc.setFillColor(...LIGHT);
  doc.rect(MARGIN, MARGIN + 20, DRAW_W, DRAW_H, "F");

  // Draw paths
  for (const path of block.paths) {
    drawPath(doc, path, ox, oy, mmPerIn);
  }

  // Labels
  doc.setLineDashPattern([], 0);
  for (const label of block.labels) {
    const lx = ox + label.x * mmPerIn;
    const ly = oy + label.y * mmPerIn;
    const fs = (label.fontSize ?? 5) * fit * 1.8; // scale font with block
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5, fs));
    doc.setTextColor(...NAVY);

    if (label.rotate) {
      doc.text(label.text, lx, ly, {
        angle: label.rotate,
        align: (label.anchor === "start"
          ? "left"
          : label.anchor === "middle"
            ? "center"
            : label.anchor === "end"
              ? "right"
              : "left") as "left" | "center" | "right",
      });
    } else {
      doc.text(label.text, lx, ly, {
        align: (label.anchor === "start"
          ? "left"
          : label.anchor === "middle"
            ? "center"
            : label.anchor === "end"
              ? "right"
              : "left") as "left" | "center" | "right",
      });
    }
  }

  // Scale bar and ratio
  const sbY = PAGE_H - MARGIN - 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(scaleStr, MARGIN, sbY);

  // Draw a scale bar: 1 in at current scale
  const barLen = 1 * mmPerIn;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([], 0);
  doc.line(MARGIN, sbY + 3, MARGIN + barLen, sbY + 3);
  doc.line(MARGIN, sbY + 1.5, MARGIN, sbY + 4.5);
  doc.line(MARGIN + barLen, sbY + 1.5, MARGIN + barLen, sbY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("1 in", MARGIN + barLen / 2, sbY + 7, { align: "center" });

  // Notes
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  block.notes.forEach((note, i) => {
    doc.text(`• ${note}`, PAGE_W / 2, sbY + i * 4, { align: "center" });
  });
}

// ── Cover page ────────────────────────────────────────────────────────────────

function addCoverPage(
  doc: jsPDF,
  customerName: string,
  blocks: PatternBlock[],
) {
  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 50, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("PATTERN BLOCKS", PAGE_W / 2, 22, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text("AtelierHQ — Basic Draft Blocks", PAGE_W / 2, 33, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`Customer: ${customerName}`, PAGE_W / 2, 43, { align: "center" });

  // Block index table
  autoTable(doc, {
    startY: 60,
    head: [["Block", "Required Measurements", "Status"]],
    body: blocks.map((b) => [
      b.name,
      Object.entries(b.labels.find((l) => l.text.includes("in"))?.text ?? "")
        .join("")
        .trim() || "—",
      b.missingMeasurements.length === 0
        ? "Ready"
        : `Missing: ${b.missingMeasurements.join(", ")}`,
    ]),
    theme: "grid",
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 2: { fontStyle: "bold" } },
    margin: { left: MARGIN, right: MARGIN },
  });

  // Disclaimer
  const afterTable =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 140) + 15;

  doc.setFillColor(...LIGHT);
  doc.roundedRect(MARGIN, afterTable, DRAW_W, 36, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text("Important notice", MARGIN + 4, afterTable + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const disclaimer =
    "These are basic front blocks generated from body measurements using standard " +
    "quarter-measurement + ease formulas. They are starting drafts only and must be " +
    "tested in cheap fabric (toile), trued up at seam lines, and adjusted by a trained " +
    "patternmaker before cutting final fabric. No bust dart is included in the bodice " +
    "blocks — add from side seam for a fitted garment.";
  const lines = doc.splitTextToSize(disclaimer, DRAW_W - 8);
  doc.text(lines, MARGIN + 4, afterTable + 16);

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    `Generated: ${new Date().toLocaleDateString()}`,
    PAGE_W - MARGIN,
    PAGE_H - MARGIN,
    {
      align: "right",
    },
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generatePatternsPDF(
  blocks: PatternBlock[],
  customerName: string,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Cover page (first page)
  addCoverPage(doc, customerName, blocks);

  // One block per page
  for (const block of blocks) {
    addBlockPage(doc, block);
  }

  return doc;
}

export function downloadPatternsPDF(
  blocks: PatternBlock[],
  customerName: string,
): void {
  const doc = generatePatternsPDF(blocks, customerName);
  const safeName = customerName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`patterns-${safeName}.pdf`);
}
