import type { PatternPiece } from "./geometry";

/**
 * Serializes a pattern piece into a standalone, self-contained SVG file
 * string — millimeters as the unit, so opening it in any vector editor (or
 * printing it directly) preserves true scale. Used for the browser-side
 * "Download SVG" button; the returned string is written straight to a Blob,
 * no server round-trip involved.
 */
export function pieceToStandaloneSvg(piece: PatternPiece): string {
  const { minX, minY, maxX, maxY } = piece.boundingBoxMM;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" ` +
    `viewBox="${minX} ${minY} ${width} ${height}">\n` +
    `  <title>${escapeXml(piece.name)}</title>\n` +
    `  <path d="${piece.pathMM}" stroke="black" stroke-width="0.6" fill="none" />\n` +
    `</svg>\n`
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
