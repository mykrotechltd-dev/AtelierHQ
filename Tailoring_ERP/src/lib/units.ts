/**
 * Length-unit conversion for measurement display/input.
 *
 * Every measurement is stored in centimetres everywhere in this app — the
 * pattern-drafting engine, the customer record, the database. This module
 * only converts at the UI boundary: what a tailor types is interpreted in
 * their chosen display unit and converted to cm before it reaches any
 * stored value; what's shown on screen is converted from the stored cm back
 * to their chosen unit. Nothing downstream of the UI ever sees inches.
 */

export type MeasurementUnit = "cm" | "in";

const CM_PER_IN = 2.54;

export function cmToUnit(cm: number, unit: MeasurementUnit): number {
  return unit === "in" ? cm / CM_PER_IN : cm;
}

export function unitToCm(value: number, unit: MeasurementUnit): number {
  return unit === "in" ? value * CM_PER_IN : value;
}

/** Rounds for display — one decimal place in either unit. */
export function formatMeasurement(cm: number, unit: MeasurementUnit): string {
  return (Math.round(cmToUnit(cm, unit) * 10) / 10).toString();
}

export function unitLabel(unit: MeasurementUnit): string {
  return unit === "in" ? "in" : "cm";
}
