import type { PatternBlock } from "@/lib/pattern-engine.ts";

const PATH_STROKES: Record<string, string> = {
  outline: `stroke="#1c2850" stroke-width="2" fill="#f8f6f0"`,
  dart: `stroke="#1c2850" stroke-width="1" stroke-dasharray="6 3" fill="none"`,
  grainline: `stroke="#b48c3c" stroke-width="1.5" fill="none"`,
  construction: `stroke="#6b7280" stroke-width="0.75" stroke-dasharray="4 3" fill="none"`,
  fold: `stroke="#b48c3c" stroke-width="1.5" stroke-dasharray="8 3" fill="none"`,
};

// Every block's labels (title, "Bust line", "C F", etc.) carry a hand-picked
// fontSize that was sized by eye against one typical block, not measured
// against that block's own width — so a narrow trouser leg or a small size's
// bodice can end up with a title wider than the piece itself. Rather than
// hand-tune every label in every block generator, shrink each label here,
// at the one place all of them pass through, so it always fits the block
// it actually landed on. 0.82em/char is calibrated against a real rendered
// SVG <text> getBBox() for this font stack — our all-caps titles ("TROUSER
// FRONT") measured ~0.77em/char in Chromium, so 0.82 keeps a small safety
// margin for other renderers. Erring toward shrinking a label a bit more
// than strictly necessary is harmless; letting one run past the edge of
// the piece is not.
const CHAR_WIDTH_EM = 0.82;

function fittedFontSize(
  l: PatternBlock["labels"][number],
  box: { x: number; y: number; w: number; h: number },
): number {
  const base = l.fontSize ?? 5;
  // A ±90° label runs along the block's height, not its width.
  const vertical = Math.abs(l.rotate ?? 0) === 90;
  const axisStart = vertical ? box.y : box.x;
  const axisSize = vertical ? box.h : box.w;
  const pos = vertical ? l.y : l.x;
  const margin = axisSize * 0.04;

  let available: number;
  if (l.anchor === "middle") {
    available = 2 * Math.min(pos - axisStart, axisStart + axisSize - pos) - margin;
  } else if (l.anchor === "end") {
    available = pos - axisStart - margin;
  } else {
    available = axisStart + axisSize - pos - margin;
  }

  const estimatedWidth = l.text.length * base * CHAR_WIDTH_EM;
  if (available > 0 && estimatedWidth > available) {
    // No hard floor above what the fit actually needs — a small but
    // correctly-fitted label beats a bigger one that overflows its block.
    return Math.max(base * (available / estimatedWidth), 1);
  }
  return base;
}

/** Self-contained SVG file for one block. Colours are fixed so the export
 *  prints the same anywhere. One viewBox unit is one inch (matching every
 *  other stored measurement in this app — see lib/units.ts), so the width
 *  and height attributes convert at 25.4mm/in to stay true to size at 1:1,
 *  the same factor pattern-pdf.ts uses for the cut sheet. */
export function buildBlockSvg(block: PatternBlock): string {
  const { x, y, w, h } = block.viewBox;
  const mmW = (w * 25.4).toFixed(1);
  const mmH = (h * 25.4).toFixed(1);
  const pathsStr = block.paths
    .map(
      (p) =>
        `<path d="${p.d}" ${PATH_STROKES[p.type]} stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join("\n");
  const labelsStr = block.labels
    .map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor ?? "start"}" font-size="${fittedFontSize(l, { x, y, w, h })}" fill="#1c2850" font-family="sans-serif"${l.rotate ? ` transform="rotate(${-l.rotate}, ${l.x}, ${l.y})"` : ""}>${l.text}</text>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${mmW}mm" height="${mmH}mm">\n<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8f6f0"/>\n${pathsStr}\n${labelsStr}\n</svg>`;
}
