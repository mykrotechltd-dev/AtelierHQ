import { z } from "zod";

export const TASK_SPECIALTIES = ["cutting", "stitching", "embroidery", "hand_work", "finishing", "alteration"] as const;

export const workerSchema = z.object({
  full_name: z.string().trim().min(2, "Name is too short").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  specialties: z.array(z.enum(TASK_SPECIALTIES)).default([]),
  pay_rate_type: z.enum(["per_task", "hourly", "salary"]).default("per_task"),
  pay_rate: z.coerce.number().min(0).max(10_000_000).default(0),
});

export type WorkerInput = z.infer<typeof workerSchema>;
