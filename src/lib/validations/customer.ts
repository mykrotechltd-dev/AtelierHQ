import { z } from "zod";

export const customerSchema = z.object({
  full_name: z.string().trim().min(2, "Name is too short").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number"),
  whatsapp_number: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid WhatsApp number")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const measurementSchema = z.object({
  customer_id: z.string().uuid(),
  garment_type: z.string().trim().min(2).max(60),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  unit: z.enum(["in", "cm"]).default("in"),
  // Free-form key/value measurement fields, e.g. { chest: 40, waist: 34 }.
  // Validated loosely here; the UI drives which keys are shown per garment_type.
  values: z.record(z.string(), z.union([z.number(), z.string()])).refine(
    (v) => Object.keys(v).length > 0,
    "Add at least one measurement value"
  ),
});

export type MeasurementInput = z.infer<typeof measurementSchema>;
