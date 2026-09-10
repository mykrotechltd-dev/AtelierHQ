/**
 * Measurement validation.
 *
 * Two separate jobs:
 *
 *  - `validateMeasurements` rejects values that cannot produce a drawable block
 *    (missing, non-numeric, zero or negative). These are errors.
 *  - relationship checks flag values that are drawable but unusual (waist wider
 *    than hip, shoulder out of proportion). These are warnings: real bodies fall
 *    outside standard charts, so the tailor decides, not the software.
 *
 * Nothing here throws. A caller always gets a result it can render.
 */

import {
  PLAUSIBLE_RANGE,
  SHOULDER_CROSS_THRESHOLD,
  SHOULDER_SEAM_RANGE,
} from "./constants.ts";
import type {
  Diagnostic,
  MeasurementKey,
  Measurements,
  ValidationResult,
} from "./types.ts";

/** Human-readable names used in diagnostic messages. */
export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  chest: "Chest / bust",
  waist: "Waist",
  hips: "Hips",
  shoulder: "Shoulder",
  sleeveLength: "Sleeve length",
  inseam: "Inseam",
  neck: "Neck",
  thigh: "Thigh",
  height: "Height",
  backNeckToWaist: "Nape to waist",
  frontNeckToWaist: "Front neck to waist",
  waistToHip: "Waist to hip",
  backWidth: "Across back",
  bustPointSep: "Bust point separation",
  shoulderToBust: "Shoulder to bust point",
  shoulderDrop: "Shoulder drop",
  bustDepth: "Bust depth",
  centerFrontLength: "Centre front length",
  acrossChestWidth: "Across chest",
  centerBackLength: "Centre back length",
  acrossBackWidth: "Across back",
  sideSeamLength: "Side seam length",
};

export function labelFor(field: MeasurementKey): string {
  return MEASUREMENT_LABELS[field] ?? field;
}

/**
 * Checks the measurements a block requires.
 *
 * Returns an error diagnostic per unusable field. A field that is absent is
 * reported as missing rather than invalid, because the UI treats the two
 * differently: missing prompts for input, invalid points at a typo.
 */
export function validateMeasurements(
  m: Measurements,
  required: readonly MeasurementKey[],
): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  for (const field of required) {
    const value = m[field];

    if (value === undefined || value === null) {
      diagnostics.push({
        code: "MEASUREMENT_MISSING",
        severity: "error",
        field,
        message: `${labelFor(field)} is required for this block.`,
      });
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      diagnostics.push({
        code: "MEASUREMENT_NOT_A_NUMBER",
        severity: "error",
        field,
        message: `${labelFor(field)} must be a number.`,
      });
      continue;
    }
    if (value <= 0) {
      diagnostics.push({
        code: "MEASUREMENT_NOT_POSITIVE",
        severity: "error",
        field,
        message: `${labelFor(field)} must be greater than zero.`,
      });
    }
  }

  // Optional fields that are present must still be sane.
  for (const [key, value] of Object.entries(m) as [
    MeasurementKey,
    number | undefined,
  ][]) {
    if (value === undefined || required.includes(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      diagnostics.push({
        code: "MEASUREMENT_NOT_POSITIVE",
        severity: "error",
        field: key,
        message: `${labelFor(key)} must be a positive number, or left blank.`,
      });
    }
  }

  return {
    valid: !diagnostics.some((d) => d.severity === "error"),
    diagnostics,
  };
}

/**
 * Flags measurement combinations that are physically possible but unusual, and
 * so are more often a recording error than a real body.
 *
 * Warnings only — every one of these still drafts.
 */
export function checkRelationships(m: Measurements): Diagnostic[] {
  const out: Diagnostic[] = [];

  if (m.waist !== undefined && m.hips !== undefined && m.waist > m.hips) {
    out.push({
      code: "WAIST_EXCEEDS_HIP",
      severity: "warning",
      field: "waist",
      message: `Waist (${m.waist} in) is larger than hips (${m.hips} in). Check the measurements — the skirt and dress blocks will have no hip shaping.`,
    });
  }

  if (m.waist !== undefined && m.chest !== undefined && m.waist > m.chest) {
    out.push({
      code: "WAIST_EXCEEDS_CHEST",
      severity: "warning",
      field: "waist",
      message: `Waist (${m.waist} in) is larger than chest (${m.chest} in). The bodice will have no waist dart.`,
    });
  }

  // A shoulder is either a cross-shoulder or a single seam; anything between the
  // two plausible bands is ambiguous and worth querying.
  if (m.shoulder !== undefined) {
    const s = m.shoulder;
    const looksCross = s >= SHOULDER_CROSS_THRESHOLD;
    const plausibleSeam =
      s >= SHOULDER_SEAM_RANGE.min && s <= SHOULDER_SEAM_RANGE.max;
    if (!looksCross && !plausibleSeam) {
      out.push({
        code: "SHOULDER_OUT_OF_RANGE",
        severity: "warning",
        field: "shoulder",
        message: `Shoulder of ${s} in is outside the usual range — about 4.3–6.3 in for a single shoulder seam, or 14.2–18.1 in measured tip to tip.`,
      });
    }
    if (looksCross && m.chest !== undefined && s > m.chest * 0.6) {
      out.push({
        code: "SHOULDER_OUT_OF_RANGE",
        severity: "warning",
        field: "shoulder",
        message: `Shoulder (${s} in) is unusually wide relative to chest (${m.chest} in).`,
      });
    }
  }

  for (const [key, range] of Object.entries(PLAUSIBLE_RANGE) as [
    MeasurementKey,
    { min: number; max: number },
  ][]) {
    const value = m[key];
    if (value === undefined || !Number.isFinite(value) || value <= 0) continue;
    if (value < range.min || value > range.max) {
      out.push({
        code:
          key === "neck"
            ? "NECK_OUT_OF_RANGE"
            : key === "height"
              ? "HEIGHT_OUT_OF_RANGE"
              : "SHOULDER_OUT_OF_RANGE",
        severity: "warning",
        field: key,
        message: `${labelFor(key)} of ${value} in is outside the usual ${range.min.toFixed(1)}–${range.max.toFixed(1)} in range. Check for a typo or a units mix-up.`,
      });
    }
  }

  return out;
}
