import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUserAndTenant } from "./users.ts";

// ── Workers ──────────────────────────────────────────────────────────────────

export const listWorkers = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireUserAndTenant(ctx);
    return await ctx.db
      .query("workers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();
  },
});

export const getWorker = query({
  args: { id: v.id("workers") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const worker = await ctx.db.get(args.id);
    if (!worker || worker.tenantId !== tenantId) {
      throw new ConvexError({ message: "Worker not found", code: "NOT_FOUND" });
    }
    return worker;
  },
});

export const createWorker = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    specialization: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    return await ctx.db.insert("workers", {
      tenantId,
      name: args.name,
      phone: args.phone,
      specialization: args.specialization,
      isActive: true,
    });
  },
});

export const updateWorker = mutation({
  args: {
    id: v.id("workers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    specialization: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const worker = await ctx.db.get(args.id);
    if (!worker || worker.tenantId !== tenantId) {
      throw new ConvexError({ message: "Worker not found", code: "NOT_FOUND" });
    }
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteWorker = mutation({
  args: { id: v.id("workers") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const worker = await ctx.db.get(args.id);
    if (!worker || worker.tenantId !== tenantId) {
      throw new ConvexError({ message: "Worker not found", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.id);
  },
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const listTasks = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("done"))
    ),
    workerId: v.optional(v.id("workers")),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    let tasks;
    if (args.status) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .order("desc")
        .collect();
    }

    if (args.workerId) {
      tasks = tasks.filter((t) => t.workerId === args.workerId);
    }

    // Enrich with worker name + order number
    return await Promise.all(
      tasks.map(async (task) => {
        const worker = await ctx.db.get(task.workerId);
        const order = await ctx.db.get(task.orderId);
        return {
          ...task,
          workerName: worker?.name ?? "Unknown",
          orderNumber: order?.orderNumber ?? "—",
        };
      })
    );
  },
});

export const createTask = mutation({
  args: {
    orderId: v.id("orders"),
    orderItemId: v.optional(v.id("orderItems")),
    workerId: v.id("workers"),
    description: v.string(),
    dueDate: v.optional(v.string()),
    payout: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order || order.tenantId !== tenantId) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    const worker = await ctx.db.get(args.workerId);
    if (!worker || worker.tenantId !== tenantId) {
      throw new ConvexError({ message: "Worker not found", code: "NOT_FOUND" });
    }

    return await ctx.db.insert("tasks", {
      tenantId,
      orderId: args.orderId,
      orderItemId: args.orderItemId,
      workerId: args.workerId,
      description: args.description,
      status: "pending",
      dueDate: args.dueDate,
      payout: args.payout,
    });
  },
});

export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    description: v.optional(v.string()),
    workerId: v.optional(v.id("workers")),
    dueDate: v.optional(v.string()),
    payout: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("done"))
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.tenantId !== tenantId) {
      throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    }
    const { id, ...updates } = args;
    const patch: Record<string, unknown> = { ...updates };
    if (updates.status === "done" && task.status !== "done") {
      patch.completedAt = new Date().toISOString();
    }
    await ctx.db.patch(id, patch);
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.tenantId !== tenantId) {
      throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.id);
  },
});

// ── Payouts ───────────────────────────────────────────────────────────────────

export const listPayouts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    workerId: v.optional(v.id("workers")),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const base = args.workerId
      ? ctx.db
          .query("workerPayouts")
          .withIndex("by_worker", (q) => q.eq("workerId", args.workerId!))
          .order("desc")
      : ctx.db
          .query("workerPayouts")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .order("desc");

    const result = await base.paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (payout) => {
        const worker = await ctx.db.get(payout.workerId);
        return { ...payout, workerName: worker?.name ?? "Unknown" };
      })
    );
    return { ...result, page };
  },
});

export const recordPayout = mutation({
  args: {
    workerId: v.id("workers"),
    amount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const worker = await ctx.db.get(args.workerId);
    if (!worker || worker.tenantId !== tenantId) {
      throw new ConvexError({ message: "Worker not found", code: "NOT_FOUND" });
    }
    return await ctx.db.insert("workerPayouts", {
      tenantId,
      workerId: args.workerId,
      amount: args.amount,
      notes: args.notes,
      paidAt: new Date().toISOString(),
    });
  },
});

export const deletePayout = mutation({
  args: { id: v.id("workerPayouts") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const payout = await ctx.db.get(args.id);
    if (!payout || payout.tenantId !== tenantId) {
      throw new ConvexError({ message: "Payout not found", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.id);
  },
});
