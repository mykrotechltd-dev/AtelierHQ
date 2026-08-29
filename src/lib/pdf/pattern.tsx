import { Document, Page, View, Text, Svg, Path, Line, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { PatternPiece } from "@/lib/pattern/geometry";
import { offsetPolygon, pointsToClosedPathData } from "@/lib/pattern/geometry";
import {
  computeTileGrid,
  PRINTABLE_WIDTH_MM,
  PRINTABLE_HEIGHT_MM,
  PAGE_MARGIN_MM,
  CALIBRATION_SQUARE_MM,
} from "@/lib/pattern/tiling";

const MM_TO_PT = 72 / 25.4;
const mm = (v: number) => v * MM_TO_PT;

const styles = StyleSheet.create({
  coverPage: { padding: mm(PAGE_MARGIN_MM), fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#64748b", marginBottom: 2 },
  section: { marginTop: 14 },
  label: { fontSize: 9, textTransform: "uppercase", color: "#64748b", marginBottom: 4 },
  warning: { fontSize: 9, color: "#b45309", marginBottom: 2 },
  calibrationCaption: { fontSize: 9, color: "#64748b", marginTop: 6 },
  tilePage: { padding: mm(PAGE_MARGIN_MM), fontFamily: "Helvetica" },
  tileHeader: { fontSize: 9, color: "#64748b", marginBottom: 4 },
  legend: { flexDirection: "row", marginTop: 4, gap: 12 },
  legendItem: { fontSize: 8, color: "#64748b" },
});

export type PatternDocumentData = {
  shopName: string;
  orderNumber: string;
  customerName: string;
  garmentType: string;
  blockLabel: string; // e.g. "Basic skirt block"
  pieces: PatternPiece[];
  warnings: string[];
  /** Extra distance added outside the seamline, drawn as a second dashed cutting line. 0/undefined = off. */
  seamAllowanceMM?: number;
};

function CalibrationSquare() {
  const size = CALIBRATION_SQUARE_MM;
  return (
    <Svg width={mm(size)} height={mm(size)} viewBox={`0 0 ${size} ${size}`}>
      <Path d={`M 0,0 L ${size},0 L ${size},${size} L 0,${size} Z`} stroke="black" strokeWidth={0.5} fill="none" />
    </Svg>
  );
}

function TileMarks({ tile }: { tile: { x: number; y: number; width: number; height: number } }) {
  const m = 8; // mark length in mm, in the tile's own coordinate space
  const corners: [number, number][] = [
    [tile.x, tile.y],
    [tile.x + tile.width, tile.y],
    [tile.x, tile.y + tile.height],
    [tile.x + tile.width, tile.y + tile.height],
  ];
  return (
    <>
      {corners.map(([cx, cy], i) => (
        <View key={i}>
          <Line x1={cx - m} y1={cy} x2={cx + m} y2={cy} stroke="#94a3b8" strokeWidth={0.3} />
          <Line x1={cx} y1={cy - m} x2={cx} y2={cy + m} stroke="#94a3b8" strokeWidth={0.3} />
        </View>
      ))}
    </>
  );
}

export function PatternDocument({ data }: { data: PatternDocumentData }) {
  const seamAllowanceMM = data.seamAllowanceMM ?? 0;

  return (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.title}>{data.shopName}</Text>
        <Text style={styles.muted}>{data.blockLabel}</Text>
        <Text style={styles.muted}>
          Order {data.orderNumber} · {data.customerName} · {data.garmentType}
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Print calibration</Text>
          <CalibrationSquare />
          <Text style={styles.calibrationCaption}>
            Measure this square with a ruler after printing — it must be exactly {CALIBRATION_SQUARE_MM}mm ({CALIBRATION_SQUARE_MM / 10}cm)
            on each side. If it isn't, your printer scaled the page — reprint at "actual size" / 100%, not "fit to page."
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Pieces in this file</Text>
          {data.pieces.map((p, i) => (
            <Text key={i} style={styles.muted}>
              {i + 1}. {p.name}
            </Text>
          ))}
        </View>

        {seamAllowanceMM > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Seam allowance</Text>
            <Text style={styles.muted}>
              {seamAllowanceMM}mm added outside the seamline, shown as a dashed cutting line. The offset is a straight-line
              approximation around curves — true it up by eye where the pattern curves.
            </Text>
          </View>
        )}

        {data.warnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Before you cut fabric</Text>
            {data.warnings.map((w, i) => (
              <Text key={i} style={styles.warning}>
                • {w}
              </Text>
            ))}
          </View>
        )}
      </Page>

      {data.pieces.map((piece, pieceIndex) => {
        const cutPoints = seamAllowanceMM > 0 ? offsetPolygon(piece.points, seamAllowanceMM) : null;
        const cutPath = cutPoints ? pointsToClosedPathData(cutPoints) : null;
        // Tile against the larger (cutting-line) bounding box when seam allowance
        // is on, so the extra line never gets clipped off the printed pages.
        const tileBbox = cutPoints
          ? {
              minX: Math.min(piece.boundingBoxMM.minX, ...cutPoints.map((p) => p[0])),
              maxX: Math.max(piece.boundingBoxMM.maxX, ...cutPoints.map((p) => p[0])),
              minY: Math.min(piece.boundingBoxMM.minY, ...cutPoints.map((p) => p[1])),
              maxY: Math.max(piece.boundingBoxMM.maxY, ...cutPoints.map((p) => p[1])),
            }
          : piece.boundingBoxMM;
        const { rows, cols, tiles } = computeTileGrid(tileBbox);

        return tiles.map((tile, tileIndex) => (
          <Page key={`${pieceIndex}-${tileIndex}`} size="A4" style={styles.tilePage}>
            <Text style={styles.tileHeader}>
              {piece.name} — tile row {tile.row + 1} col {tile.col + 1} of {rows}×{cols}. Tape pages together using the overlapping edges.
            </Text>
            <Svg width={mm(PRINTABLE_WIDTH_MM)} height={mm(PRINTABLE_HEIGHT_MM)} viewBox={`${tile.x} ${tile.y} ${tile.width} ${tile.height}`}>
              <TileMarks tile={tile} />
              {cutPath && <Path d={cutPath} stroke="#b45309" strokeWidth={0.5} strokeDasharray="3,2" fill="none" />}
              <Path d={piece.pathMM} stroke="black" strokeWidth={0.6} fill="none" />
            </Svg>
            {cutPath && (
              <View style={styles.legend}>
                <Text style={styles.legendItem}>— Seamline</Text>
                <Text style={styles.legendItem}>- - Cutting line (+{seamAllowanceMM}mm)</Text>
              </View>
            )}
          </Page>
        ));
      })}
    </Document>
  );
}

export async function renderPatternPdf(data: PatternDocumentData): Promise<Buffer> {
  return renderToBuffer(<PatternDocument data={data} />);
}
