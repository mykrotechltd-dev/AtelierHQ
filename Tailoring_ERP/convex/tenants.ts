import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// Helper: get user and tenant membership
async function getUserAndTenant(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

  const membership = await ctx.db
    .query("tenantMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();

  return { user, membership };
}

export const createTenant = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    currency: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Check not already in a tenant
    const existing = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) throw new ConvexError({ message: "Already belongs to a shop", code: "CONFLICT" });

    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      ownerUserId: user._id,
      phone: args.phone,
      address: args.address,
      currency: args.currency,
    });

    await ctx.db.insert("tenantMembers", {
      tenantId,
      userId: user._id,
      role: "owner",
    });

    return tenantId;
  },
});

export const updateTenant = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { membership } = await getUserAndTenant(ctx);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError({ message: "Only owners can update shop settings", code: "FORBIDDEN" });
    }

    const updates: Record<string, string> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.address !== undefined) updates.address = args.address;
    if (args.currency !== undefined) updates.currency = args.currency;

    await ctx.db.patch(membership.tenantId, updates);
  },
});

export const getMyTenant = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!membership) return null;

    const tenant = await ctx.db.get(membership.tenantId);
    return tenant ? { ...tenant, role: membership.role } : null;
  },
});
