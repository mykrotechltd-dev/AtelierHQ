import type { PatternBlock } from "@/lib/pattern-engine.ts";

const PATH_STROKES: Record<string, string> = {
  outline: `stroke="#1c2850" stroke-width="2" fill="#f8f6f0"`,
  dart: `stroke="#1c2850" stroke-width="1" stroke-dasharray="6 3" fill="none"`,
  grainline: `stroke="#b48c3c" stroke-width="1.5" fill="none"`,
  construction: `stroke="#6b7280" stroke-width="0.75" stroke-dasharray="4 3" fill="none"`,
  fold: `stroke="#b48c3c" stroke-width="1.5" stroke-dasharray="8 3" fill="none"`,
};

/** Self-contained SVG file for one block. Colours are fixed so the export
 *  prints the same anywhere. One viewBox unit is one centimetre, so the
 *  width and height attributes are in millimetres at 1:1. */
export function buildBlockSvg(block: PatternBlock): string {
  const { x, y, w, h } = block.viewBox;
  const pathsStr = block.paths
    .map(
      (p) =>
        `<path d="${p.d}" ${PATH_STROKES[p.type]} stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join("\n");
  const labelsStr = block.labels
    .map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor ?? "start"}" font-size="${l.fontSize ?? 5}" fill="#1c2850" font-family="sans-serif"${l.rotate ? ` transform="rotate(${-l.rotate}, ${l.x}, ${l.y})"` : ""}>${l.text}</text>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * 10}mm" height="${h * 10}mm">\n<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8f6f0"/>\n${pathsStr}\n${labelsStr}\n</svg>`;
}
