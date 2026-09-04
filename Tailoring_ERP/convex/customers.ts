import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUserAndTenant } from "./users.ts";

const measurementsValidator = v.optional(
  v.object({
    chest: v.optional(v.number()),
    waist: v.optional(v.number()),
    hips: v.optional(v.number()),
    shoulder: v.optional(v.number()),
    sleeveLength: v.optional(v.number()),
    inseam: v.optional(v.number()),
    neck: v.optional(v.number()),
    thigh: v.optional(v.number()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
);

export const listCustomers = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    if (args.search && args.search.trim()) {
      const results = await ctx.db
        .query("customers")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!).eq("tenantId", tenantId)
        )
        .take(50);
      return { page: results, isDone: true, continueCursor: "" };
    }

    return await ctx.db
      .query("customers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getCustomer = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.tenantId !== tenantId) {
      throw new ConvexError({ message: "Customer not found", code: "NOT_FOUND" });
    }
    return customer;
  },
});

export const createCustomer = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    measurements: measurementsValidator,
  },
  handler: async (ctx, args): Promise<string> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    return await ctx.db.insert("customers", { ...args, tenantId });
  },
});

export const updateCustomer = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    measurements: measurementsValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.tenantId !== tenantId) {
      throw new ConvexError({ message: "Customer not found", code: "NOT_FOUND" });
    }
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteCustomer = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args): Promise<void> => {
    const { tenantId } = await requireUserAndTenant(ctx);
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.tenantId !== tenantId) {
      throw new ConvexError({ message: "Customer not found", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.id);
  },
});
