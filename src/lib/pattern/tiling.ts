export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 10; // most printers can't print to the very edge
export const OVERLAP_MM = 15; // shared strip between adjacent tiles, for aligning/taping
export const CALIBRATION_SQUARE_MM = 50; // printed on page 1 so users can verify 100% scale

export const PRINTABLE_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
export const PRINTABLE_HEIGHT_MM = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;

export type Tile = { row: number; col: number; x: number; y: number; width: number; height: number };

/**
 * Splits a pattern piece's bounding box into a grid of A4-sized, slightly
 * overlapping tiles. Each tile's (x, y, width, height) is a window in the
 * pattern's own millimeter coordinate space — used directly as an SVG
 * viewBox, so the browser/PDF renderer does the clipping for us.
 */
export function computeTileGrid(bbox: { minX: number; maxX: number; minY: number; maxY: number }): {
  rows: number;
  cols: number;
  tiles: Tile[];
} {
  const totalW = bbox.maxX - bbox.minX;
  const totalH = bbox.maxY - bbox.minY;
  const stepW = PRINTABLE_WIDTH_MM - OVERLAP_MM;
  const stepH = PRINTABLE_HEIGHT_MM - OVERLAP_MM;

  const cols = totalW <= PRINTABLE_WIDTH_MM ? 1 : Math.ceil((totalW - PRINTABLE_WIDTH_MM) / stepW) + 1;
  const rows = totalH <= PRINTABLE_HEIGHT_MM ? 1 : Math.ceil((totalH - PRINTABLE_HEIGHT_MM) / stepH) + 1;

  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        row: r,
        col: c,
        x: bbox.minX + c * stepW,
        y: bbox.minY + r * stepH,
        width: PRINTABLE_WIDTH_MM,
        height: PRINTABLE_HEIGHT_MM,
      });
    }
  }

  return { rows, cols, tiles };
}
