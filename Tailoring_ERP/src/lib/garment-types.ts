// Garment type → required/optional measurement mapping for order items.
// Reuses the existing 10-field customer measurement profile (no new fields) —
// see src/lib/supabase/types.ts's Measurements interface.
import type { Measurements } from "./supabase/types.ts";

export const GARMENT_TYPES = [
  "Shirt",
  "Trousers",
  "Skirt",
  "Dress",
  "Suit/Jacket",
  "Gown",
] as const;

export type GarmentType = (typeof GARMENT_TYPES)[number];

export type MeasurementField = keyof Omit<Measurements, "notes" | "weight">;

export const MEASUREMENT_LABELS: Record<MeasurementField, string> = {
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  shoulder: "Shoulder",
  sleeveLength: "Sleeve length",
  inseam: "Inseam",
  neck: "Neck",
  thigh: "Thigh",
  height: "Height",
};

interface GarmentMeasurementSpec {
  required: MeasurementField[];
  optional: MeasurementField[];
}

export const GARMENT_MEASUREMENT_MAP: Record<GarmentType, GarmentMeasurementSpec> = {
  Shirt: { required: ["chest", "shoulder", "sleeveLength", "neck"], optional: ["height"] },
  Trousers: { required: ["waist", "hips", "inseam"], optional: ["thigh", "height"] },
  Skirt: { required: ["waist", "hips"], optional: ["height"] },
  Dress: { required: ["chest", "waist", "hips", "shoulder"], optional: ["sleeveLength", "height"] },
  "Suit/Jacket": { required: ["chest", "shoulder", "sleeveLength"], optional: ["waist", "neck", "height"] },
  Gown: { required: ["chest", "waist", "hips", "shoulder"], optional: ["sleeveLength", "height"] },
};

/** Returns the required/optional measurement fields for a garment type, or
 *  undefined for a type outside the mapped list (free-text legacy values). */
export function measurementSpecForGarment(
  garmentType: string | null | undefined
): GarmentMeasurementSpec | undefined {
  return GARMENT_MEASUREMENT_MAP[garmentType as GarmentType];
}
