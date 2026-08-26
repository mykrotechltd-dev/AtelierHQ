import { z } from "zod";

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  unit: z.enum(["yards", "meters", "pieces", "rolls"]).default("yards"),
  quantity_on_hand: z.coerce.number().min(0).max(1_000_000).default(0),
  reorder_threshold: z.coerce.number().min(0).max(1_000_000).default(0),
  unit_cost: z.coerce.number().min(0).max(10_000_000).default(0),
  supplier: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
