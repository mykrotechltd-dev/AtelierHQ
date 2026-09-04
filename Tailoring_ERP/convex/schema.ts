import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  tenants: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    currency: v.string(), // e.g. "USD", "NGN"
  }).index("by_owner", ["ownerUserId"]),

  // Links users to tenants (owner + workers)
  tenantMembers: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("worker")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_tenant_user", ["tenantId", "userId"]),

  customers: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Measurements (in cm)
    measurements: v.optional(
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
    ),
  })
    .index("by_tenant", ["tenantId"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["tenantId"] }),

  orders: defineTable({
    tenantId: v.id("tenants"),
    customerId: v.id("customers"),
    orderNumber: v.string(), // e.g. "ORD-0042"
    status: v.union(
      v.literal("received"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("delivered")
    ),
    dueDate: v.optional(v.string()), // ISO date string
    totalAmount: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_customer", ["customerId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    tenantId: v.id("tenants"),
    description: v.string(), // e.g. "Ankara Senator suit"
    garmentType: v.optional(v.string()),
    fabric: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_order", ["orderId"])
    .index("by_tenant", ["tenantId"]),

  workers: defineTable({
    tenantId: v.id("tenants"),
    userId: v.optional(v.id("users")), // linked user account (optional)
    name: v.string(),
    phone: v.optional(v.string()),
    specialization: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_tenant", ["tenantId"]),

  tasks: defineTable({
    tenantId: v.id("tenants"),
    orderId: v.id("orders"),
    orderItemId: v.optional(v.id("orderItems")),
    workerId: v.id("workers"),
    description: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    dueDate: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    payout: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_order", ["orderId"])
    .index("by_worker", ["workerId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  payments: defineTable({
    tenantId: v.id("tenants"),
    customerId: v.id("customers"),
    orderId: v.id("orders"),
    amount: v.number(),
    method: v.union(
      v.literal("cash"),
      v.literal("bank_transfer"),
      v.literal("card"),
      v.literal("other")
    ),
    notes: v.optional(v.string()),
    paidAt: v.string(), // ISO datetime
  })
    .index("by_tenant", ["tenantId"])
    .index("by_order", ["orderId"])
    .index("by_customer", ["customerId"]),

  workerPayouts: defineTable({
    tenantId: v.id("tenants"),
    workerId: v.id("workers"),
    amount: v.number(),
    notes: v.optional(v.string()),
    paidAt: v.string(), // ISO datetime
  })
    .index("by_tenant", ["tenantId"])
    .index("by_worker", ["workerId"]),
});
