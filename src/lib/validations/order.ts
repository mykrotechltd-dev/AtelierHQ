import { z } from "zod";

export const orderItemSchema = z.object({
  garment_type: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(100),
  unit_price: z.coerce.number().min(0).max(10_000_000),
  measurement_id: z.string().uuid().optional().nullable(),
  fabric_notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const orderSchema = z.object({
  customer_id: z.string().uuid(),
  due_date: z.string().date().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Add at least one garment/item"),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const ORDER_STATUSES = ["received", "in_progress", "completed", "delivered", "cancelled"] as const;

// Only these forward/backward transitions are allowed — prevents e.g.
// jumping straight from "received" to "delivered" by mistake.
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ["in_progress", "cancelled"],
  in_progress: ["completed", "received", "cancelled"],
  completed: ["delivered", "in_progress"],
  delivered: [],
  cancelled: [],
};

export const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

export const recordPaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(10_000_000),
  method: z.enum(["cash", "card", "bank_transfer", "mobile_money", "other"]),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateOrderItemSchema = z.object({
  item_id: z.string().uuid(),
  order_id: z.string().uuid(),
  garment_type: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(100),
  unit_price: z.coerce.number().min(0).max(10_000_000),
  measurement_id: z.string().uuid().optional().nullable(),
});

export const assignTaskSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid().optional().nullable(),
  task_type: z.enum(["cutting", "stitching", "embroidery", "hand_work", "finishing", "alteration"]),
  assigned_to: z.string().uuid(),
  due_date: z.string().date().optional().nullable(),
  pay_amount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
