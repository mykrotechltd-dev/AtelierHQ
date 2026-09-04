import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUserAndTenant } from "./users.ts";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

const ORDER_STATUSES = ["received", "in_progress", "completed", "delivered"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

// Valid status transitions
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ["in_progress"],
  in_progress: ["completed"],
  completed: ["delivered"],
  delivered: [],
};

async function generateOrderNumber(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<string> {
  // Count all orders for this tenant to create a sequential number
  const existing = await ctx.db
    .query("orders")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect();
  const num = (existing.length + 1).toString().padStart(4, "0");
  return `ORD-${num}`;
}

export const listOrders = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("delivered")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const base = args.status
      ? ctx.db
          .query("orders")
          .withIndex("by_tenant_status", (q) =>
            q.eq("tenantId", tenantId).eq("status", args.status!)
          )
          .order("desc")
      : ctx.db
          .query("orders")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .order("desc");

    const result = await base.paginate(args.paginationOpts);

    // Enrich with customer name
    const page = await Promise.all(
      result.page.map(async (order) => {
        const customer = await ctx.db.get(order.customerId);
        return { ...order, customerName: customer?.name ?? "Unknown" };
      })
    );

    return { ...result, page };
  },
});

export const getOrder = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const order = await ctx.db.get(args.id);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    const customer = await ctx.db.get(order.customerId);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .collect();
    return { ...order, customer, items };
  },
});

export const createOrder = mutation({
  args: {
    customerId: v.id("customers"),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    items: v.array(
      v.object({
        description: v.string(),
        garmentType: v.optional(v.string()),
        fabric: v.optional(v.string()),
        quantity: v.number(),
        unitPrice: v.number(),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);

    // Validate customer belongs to tenant
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.tenantId !== tenantId) {
      throw new ConvexError({ message: "Customer not found", code: "NOT_FOUND" });
    }

    const totalAmount = args.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const orderNumber = await generateOrderNumber(ctx, tenantId);

    const orderId = await ctx.db.insert("orders", {
      tenantId,
      customerId: args.customerId,
      orderNumber,
      status: "received",
      dueDate: args.dueDate,
      totalAmount,
      notes: args.notes,
    });

    for (const item of args.items) {
      await ctx.db.insert("orderItems", {
        orderId,
        tenantId,
        ...item,
      });
    }

    return orderId;
  },
});

export const updateOrder = mutation({
  args: {
    id: v.id("orders"),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const order = await ctx.db.get(args.id);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    await ctx.db.patch(args.id, {
      dueDate: args.dueDate,
      notes: args.notes,
    });
  },
});

export const advanceOrderStatus = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const order = await ctx.db.get(args.id);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    const next = ALLOWED_TRANSITIONS[order.status as OrderStatus][0];
    if (!next) {
      throw new ConvexError({ message: "Order is already delivered", code: "BAD_REQUEST" });
    }
    await ctx.db.patch(args.id, { status: next });
  },
});

export const addOrderItem = mutation({
  args: {
    orderId: v.id("orders"),
    description: v.string(),
    garmentType: v.optional(v.string()),
    fabric: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    const { orderId, ...rest } = args;
    const itemId = await ctx.db.insert("orderItems", { orderId, tenantId, ...rest });

    // Recalculate total
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    await ctx.db.patch(orderId, { totalAmount: total });

    return itemId;
  },
});

export const updateOrderItem = mutation({
  args: {
    id: v.id("orderItems"),
    description: v.optional(v.string()),
    garmentType: v.optional(v.string()),
    fabric: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.tenantId !== tenantId) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    // Recalculate total
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", item.orderId))
      .collect();
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    await ctx.db.patch(item.orderId, { totalAmount: total });
  },
});

export const deleteOrderItem = mutation({
  args: { id: v.id("orderItems") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.tenantId !== tenantId) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    const orderId = item.orderId;
    await ctx.db.delete(args.id);

    // Recalculate total
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    await ctx.db.patch(orderId, { totalAmount: total });
  },
});

export const deleteOrder = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const order = await ctx.db.get(args.id);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    // Delete all items first
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.id);
  },
});
