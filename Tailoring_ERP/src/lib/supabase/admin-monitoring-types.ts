// Shapes returned by the monitoring RPCs in
// supabase/migrations/0008_activity_and_audit.sql. Money is always grouped by
// currency and never summed across currencies.

export interface AdminActivityEvent {
  id: number;
  createdAt: string;
  tenantId: string;
  tenantName: string;
  actorEmail: string | null;
  actorRole: "owner" | "worker" | "system" | "member";
  action: string;
  category: "orders" | "payments" | "customers" | "team";
  resource: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
}

export interface AdminAuditEntry {
  id: number;
  createdAt: string;
  adminEmail: string | null;
  action: string;
  detail: string | null;
  rowCount: number;
  reason: string | null;
  targetTenantName: string | null;
  ip: string | null;
}

export interface MoneyByCurrency {
  currency: string;
  amount: number;
}

export interface AdminPlatformOverview {
  shops: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    trialsEndingSoon: number;
  };
  mrr: MoneyByCurrency[];
  mrrAtRisk: MoneyByCurrency[];
  events24h: number;
  activeShops7d: number;
  eventsByHour: number[];
  weekly: { weekStart: string; newShops: number; payingShops: number }[];
}

export interface AdminTenantHealth {
  tenantId: string;
  score: number;
  factors: { activity: number; orders: number; payment: number; team: number };
  events14d: number;
  orders30d: number;
  lastActiveAt: string | null;
}

export interface AdminRecentPayment {
  id: string;
  paidAt: string;
  tenantName: string;
  planCode: string | null;
  amount: number;
  currency: string;
  reference: string;
}

/** A row from notification_outbox (0009-0011), via admin_list_notifications
 *  (0012) — the only client-readable view of that table, since it carries
 *  RLS enabled with zero client policies. */
export interface AdminNotification {
  id: number;
  createdAt: string;
  sentAt: string | null;
  tenantName: string;
  orderNumber: string | null;
  customerName: string | null;
  toStatus: "completed" | "delivered";
  templateKey: string;
  status: "pending" | "sent" | "failed" | "skipped";
  channelUsed: "whatsapp" | "rcs" | "sms" | null;
  attemptCount: number;
  lastError: string | null;
}

/** 71+ healthy, 41 to 70 watch, 0 to 40 at risk. */
export function healthBand(score: number): "good" | "warn" | "crit" {
  return score >= 71 ? "good" : score >= 41 ? "warn" : "crit";
}
