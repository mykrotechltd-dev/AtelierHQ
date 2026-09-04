import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUserAndTenant } from "./users.ts";

// ── Queries ───────────────────────────────────────────────────────────────────

export const listPayments = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const result = await ctx.db
      .query("payments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (payment) => {
        const customer = await ctx.db.get(payment.customerId);
        const order = await ctx.db.get(payment.orderId);
        return {
          ...payment,
          customerName: customer?.name ?? "Unknown",
          orderNumber: order?.orderNumber ?? "—",
          orderTotal: order?.totalAmount ?? 0,
        };
      })
    );
    return { ...result, page };
  },
});

export const getPaymentsByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .collect();

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, order.totalAmount - totalPaid);
    const overpaid = totalPaid > order.totalAmount;

    return { payments, totalPaid, outstanding, overpaid, orderTotal: order.totalAmount };
  },
});

// Summary of all outstanding balances across tenant orders
export const getOutstandingSummary = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    const allPayments = await ctx.db
      .query("payments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Group payments by order
    const paidByOrder = new Map<string, number>();
    for (const p of allPayments) {
      paidByOrder.set(p.orderId, (paidByOrder.get(p.orderId) ?? 0) + p.amount);
    }

    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let ordersWithBalance = 0;

    for (const order of allOrders) {
      const paid = paidByOrder.get(order._id) ?? 0;
      const outstanding = Math.max(0, order.totalAmount - paid);
      totalBilled += order.totalAmount;
      totalCollected += Math.min(paid, order.totalAmount);
      totalOutstanding += outstanding;
      if (outstanding > 0) ordersWithBalance++;
    }

    return { totalBilled, totalCollected, totalOutstanding, ordersWithBalance };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const recordPayment = mutation({
  args: {
    orderId: v.id("orders"),
    amount: v.number(),
    method: v.union(
      v.literal("cash"),
      v.literal("bank_transfer"),
      v.literal("card"),
      v.literal("other")
    ),
    notes: v.optional(v.string()),
    paidAt: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    if (args.amount <= 0) {
      throw new ConvexError({ message: "Amount must be greater than 0", code: "BAD_REQUEST" });
    }

    // Guard against overpayment
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    const alreadyPaid = existing.reduce((sum, p) => sum + p.amount, 0);

    if (alreadyPaid + args.amount > order.totalAmount) {
      throw new ConvexError({
        message: `Payment would exceed the order total of ${order.totalAmount}. Already paid: ${alreadyPaid}.`,
        code: "BAD_REQUEST",
      });
    }

    return await ctx.db.insert("payments", {
      tenantId,
      customerId: order.customerId,
      orderId: args.orderId,
      amount: args.amount,
      method: args.method,
      notes: args.notes,
      paidAt: args.paidAt,
    });
  },
});

export const deletePayment = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const payment = await ctx.db.get(args.id);
    if (!payment || payment.tenantId !== tenantId) {
      throw new ConvexError({ message: "Payment not found", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.id);
  },
});
