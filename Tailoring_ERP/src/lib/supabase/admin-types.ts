// Types for the platform-admin area (src/pages/admin, src/lib/queries/admin.ts).
// Kept separate from types.ts, which is the tenant-facing app's schema
// surface — the admin area reads across tenants exclusively through audited
// security-definer RPCs (admin_list_clients, admin_list_orders, admin_schedule,
// admin_list_inventory, admin_list_staff, admin_quick_search, and
// get_platform_admin_dashboard_stats), each logging to admin_access_log via
// log_admin_access(). There are no raw `_admin_select` RLS policies on any
// tenant table — supabase/migrations/0005_admin_audit_scoped_access.sql
// dropped the nine 0004_platform_admin.sql introduced, specifically because
// unrestricted table-level admin access was reachable directly through the
// client SDK, not just through these RPCs.

import type { Measurements, OrderStatus } from "./types.ts";

export type InventoryCategory = "fabric" | "thread" | "button" | "other";
export type FittingStatus = "scheduled" | "completed" | "cancelled";

/** Urgency tone the admin UI reduces every status down to, per the
 *  red/yellow/green convention: red = urgent, yellow = in progress,
 *  green = complete. */
export type AdminTone = "urgent" | "progress" | "complete";

export interface RevenueByCurrency {
  currency: string;
  today: number;
  week: number;
  month: number;
}

export interface AdminDashboardStats {
  revenueByCurrency: RevenueByCurrency[];
  activeOrders: number;
  fittingsToday: number;
  fittingsThisWeek: number;
  lowInventoryCount: number;
}

export interface AdminOrderRow {
  id: string;
  tenantId: string;
  tenantName: string;
  orderNumber: string;
  status: OrderStatus;
  dueDate: string | null;
  totalAmount: number;
  currency: string;
  customerName: string;
  garmentTypes: string[];
}

export interface AdminClientRow {
  id: string;
  tenantId: string;
  tenantName: string;
  name: string;
  phone: string | null;
  email: string | null;
  measurements: Measurements | null;
}

export interface AdminFittingRow {
  id: string;
  tenantId: string;
  tenantName: string;
  customerName: string;
  scheduledAt: string;
  status: FittingStatus;
  notes: string | null;
}

export interface AdminDeliveryRow {
  id: string;
  tenantId: string;
  tenantName: string;
  orderNumber: string;
  customerName: string;
  dueDate: string;
  status: OrderStatus;
}

export interface AdminInventoryRow {
  id: string;
  tenantId: string;
  tenantName: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
}

export interface AdminStaffRow {
  id: string;
  tenantId: string;
  tenantName: string;
  name: string;
  specialization: string | null;
  isActive: boolean;
  pendingTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  activeTaskDescriptions: string[];
}

export type TenantAccessState = "trialing" | "active" | "readonly";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface AdminTenantRow {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  subscriptionStatus: SubscriptionStatus;
  accessState: TenantAccessState;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  planCode: string | null;
}

export interface AdminSearchResult {
  kind: "order" | "client";
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  subtitle: string;
}
