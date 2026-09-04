/**
 * Bodice block — public entry point.
 *
 * Composes the layers: validate the measurements, calculate the draft, then
 * build the geometry. A caller gets either a drafted block or a placeholder
 * explaining exactly what is missing — never a throw and never a broken shape.
 */

import { calculateBodice } from "./bodice-calculator.ts";
import { buildBodiceBlock } from "./bodice-geometry.ts";
import { checkRelationships, validateMeasurements } from "./validation.ts";
import { boundsOf } from "./geometry.ts";
import {
  BLOCK_LABELS,
  BLOCK_REQUIRED,
  type BlockOptions,
  type BlockType,
  type Diagnostic,
  type Measurements,
  type MeasurementKey,
  type PanelSide,
  type PatternBlock,
} from "./types.ts";

/**
 * A block that cannot be drafted, carrying the reason why.
 *
 * Returned rather than thrown so the Pattern Lab can show a tidy placeholder
 * tile alongside the blocks that did draft.
 */
export function undraftableBlock(
  id: BlockType,
  diagnostics: Diagnostic[],
  missing: MeasurementKey[]
): PatternBlock {
  return {
    id,
    name: BLOCK_LABELS[id],
    viewBox: boundsOf([], 3),
    paths: [],
    labels: [],
    notes: [],
    diagnostics,
    calculations: {},
    estimates: [],
    metadata: {
      garment: "bodice",
      panel: id.endsWith("back") ? "back" : "front",
      cutOnFold: false,
      measurements: {},
    },
    missingMeasurements: missing,
  };
}

export function draftBodice(
  m: Measurements,
  panel: PanelSide,
  opts: BlockOptions = {}
): PatternBlock {
  const id: BlockType = panel === "front" ? "bodice-front" : "bodice-back";
  const required = BLOCK_REQUIRED[id];

  const validation = validateMeasurements(m, required);
  if (!validation.valid) {
    const missing = validation.diagnostics
      .filter((d) => d.severity === "error" && d.field)
      .map((d) => d.field as MeasurementKey);
    return undraftableBlock(id, validation.diagnostics, missing);
  }

  const draft = calculateBodice(m, panel, opts);
  const block = buildBodiceBlock(draft);

  // Relationship warnings are advisory, so they attach to a block that drafted.
  return {
    ...block,
    diagnostics: [...checkRelationships(m), ...validation.diagnostics, ...block.diagnostics],
  };
}

export function bodiceFront(m: Measurements, opts: BlockOptions = {}): PatternBlock {
  return draftBodice(m, "front", opts);
}

export function bodiceBack(m: Measurements, opts: BlockOptions = {}): PatternBlock {
  return draftBodice(m, "back", opts);
}
