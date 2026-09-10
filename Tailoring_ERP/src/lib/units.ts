/**
 * Length-unit conversion for measurement display/input.
 *
 * Every measurement is stored in inches everywhere in this app — the
 * pattern-drafting engine, the customer record, the database. This module
 * only converts at the UI boundary: what a tailor types is interpreted in
 * their chosen display unit and converted to inches before it reaches any
 * stored value; what's shown on screen is converted from the stored inches
 * back to their chosen unit. Nothing downstream of the UI ever sees cm.
 */

export type MeasurementUnit = "cm" | "in";

const CM_PER_IN = 2.54;

export function inToUnit(inches: number, unit: MeasurementUnit): number {
  return unit === "cm" ? inches * CM_PER_IN : inches;
}

export function unitToIn(value: number, unit: MeasurementUnit): number {
  return unit === "cm" ? value / CM_PER_IN : value;
}

/** Rounds for display — one decimal place in either unit. */
export function formatMeasurement(
  inches: number,
  unit: MeasurementUnit,
): string {
  return (Math.round(inToUnit(inches, unit) * 10) / 10).toString();
}

export function unitLabel(unit: MeasurementUnit): string {
  return unit === "cm" ? "cm" : "in";
}
