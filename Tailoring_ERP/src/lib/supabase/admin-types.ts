// Types for the platform-admin area (src/pages/admin, src/lib/queries/admin.ts).
// Kept separate from types.ts, which is the tenant-facing app's schema
// surface — the admin area reads across tenants via the *_admin_select RLS
// policies and get_platform_admin_dashboard_stats() added in
// supabase/migrations/0004_platform_admin.sql.

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

export interface AdminSearchResult {
  kind: "order" | "client";
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  subtitle: string;
}
