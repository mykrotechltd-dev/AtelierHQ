import { query } from "./_generated/server";
import { requireUserAndTenant } from "./users.ts";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Dashboard summary stats ───────────────────────────────────────────────────

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const [orders, payments, workers, tasks] = await Promise.all([
      ctx.db.query("orders").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("workers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("tasks").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
    ]);

    // Order counts by status
    const orderCounts = { received: 0, in_progress: 0, completed: 0, delivered: 0 };
    for (const o of orders) {
      orderCounts[o.status as keyof typeof orderCounts]++;
    }

    // Revenue
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    let revenueThisMonth = 0;
    let totalCollected = 0;
    for (const p of payments) {
      totalCollected += p.amount;
      if (p.paidAt >= monthStart && p.paidAt <= monthEnd) {
        revenueThisMonth += p.amount;
      }
    }

    const totalBilled = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOutstanding = Math.max(0, totalBilled - totalCollected);

    // Worker stats
    const activeWorkers = workers.filter((w) => w.isActive).length;
    const tasksDone = tasks.filter((t) => t.status === "done").length;
    const tasksPending = tasks.filter((t) => t.status === "pending").length;
    const tasksInProgress = tasks.filter((t) => t.status === "in_progress").length;

    return {
      orderCounts,
      totalOrders: orders.length,
      revenueThisMonth,
      totalCollected,
      totalBilled,
      totalOutstanding,
      activeWorkers,
      tasksDone,
      tasksPending,
      tasksInProgress,
    };
  },
});

// ── Monthly revenue trend (last 6 months) ────────────────────────────────────

export const getRevenueByMonth = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Build last 6 months
    const months: { key: string; label: string; billed: number; collected: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d).toISOString();
      const end = endOfMonth(d).toISOString();
      const label = format(d, "MMM yy");

      const collected = payments
        .filter((p) => p.paidAt >= start && p.paidAt <= end)
        .reduce((s, p) => s + p.amount, 0);

      // Billed = orders created in this month (by _creationTime)
      const startMs = startOfMonth(d).getTime();
      const endMs = endOfMonth(d).getTime();
      const billed = orders
        .filter((o) => o._creationTime >= startMs && o._creationTime <= endMs)
        .reduce((s, o) => s + o.totalAmount, 0);

      months.push({ key: start, label, billed, collected });
    }

    return months;
  },
});

// ── Top customers by total order value ───────────────────────────────────────

export const getTopCustomers = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Sum by customer
    const byCustomer = new Map<string, number>();
    for (const o of orders) {
      byCustomer.set(o.customerId, (byCustomer.get(o.customerId) ?? 0) + o.totalAmount);
    }

    // Fetch top 5
    const sorted = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return await Promise.all(
      sorted.map(async ([customerId, total]) => {
        const customer = await ctx.db.get(customerId as Id<"customers">);
        const orderCount = orders.filter((o) => o.customerId === customerId).length;
        return { name: customer?.name ?? "Unknown", total, orderCount };
      })
    );
  },
});

// ── Worker performance ────────────────────────────────────────────────────────

export const getWorkerPerformance = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireUserAndTenant(ctx);

    const [workers, tasks, payouts] = await Promise.all([
      ctx.db.query("workers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("tasks").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db
        .query("workerPayouts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
    ]);

    return workers.map((worker) => {
      const workerTasks = tasks.filter((t) => t.workerId === worker._id);
      const done = workerTasks.filter((t) => t.status === "done").length;
      const pending = workerTasks.filter((t) => t.status === "pending").length;
      const inProgress = workerTasks.filter((t) => t.status === "in_progress").length;
      const taskEarnings = workerTasks
        .filter((t) => t.status === "done")
        .reduce((s, t) => s + (t.payout ?? 0), 0);
      const payoutTotal = payouts
        .filter((p) => p.workerId === worker._id)
        .reduce((s, p) => s + p.amount, 0);

      return {
        name: worker.name,
        specialization: worker.specialization ?? null,
        isActive: worker.isActive,
        done,
        pending,
        inProgress,
        totalTasks: workerTasks.length,
        taskEarnings,
        payoutTotal,
      };
    });
  },
});
