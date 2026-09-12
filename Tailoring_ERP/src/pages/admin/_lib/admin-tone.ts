import { isPast, isToday, parseISO } from "date-fns";
import type { OrderStatus } from "@/lib/supabase/types.ts";
import type {
  AdminTone,
  FittingStatus,
  TenantAccessState,
} from "@/lib/supabase/admin-types.ts";

/** red = urgent, yellow = in progress, green = complete. An order is
 *  urgent once it's overdue and not yet delivered — a plain "in progress"
 *  order doesn't turn red just for existing. */
export function orderTone(status: OrderStatus, dueDate: string | null): {
  tone: AdminTone;
  label: string;
} {
  if (status === "delivered") return { tone: "complete", label: "Delivered" };
  if (status === "completed") return { tone: "complete", label: "Completed" };
  if (dueDate && isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))) {
    return { tone: "urgent", label: "Overdue" };
  }
  return {
    tone: "progress",
    label: status === "in_progress" ? "In Progress" : "Received",
  };
}

export function fittingTone(
  status: FittingStatus,
  scheduledAt: string,
): { tone: AdminTone; label: string } {
  if (status === "completed") return { tone: "complete", label: "Completed" };
  if (status === "cancelled") return { tone: "urgent", label: "Cancelled" };
  const date = parseISO(scheduledAt);
  if (isToday(date)) return { tone: "urgent", label: "Today" };
  if (isPast(date)) return { tone: "urgent", label: "Overdue" };
  return { tone: "progress", label: "Scheduled" };
}

export function taskTone(
  status: "pending" | "in_progress" | "done",
): { tone: AdminTone; label: string } {
  if (status === "done") return { tone: "complete", label: "Done" };
  if (status === "in_progress") {
    return { tone: "progress", label: "In Progress" };
  }
  return { tone: "urgent", label: "Pending" };
}

export function tenantAccessTone(
  state: TenantAccessState,
): { tone: AdminTone; label: string } {
  if (state === "active") return { tone: "complete", label: "Active" };
  if (state === "trialing") return { tone: "progress", label: "Trial" };
  return { tone: "urgent", label: "Read-only" };
}

export function inventoryTone(
  quantityOnHand: number,
  reorderThreshold: number,
): { tone: AdminTone; label: string } {
  if (quantityOnHand <= reorderThreshold) {
    return { tone: "urgent", label: "Low stock" };
  }
  return { tone: "complete", label: "In stock" };
}
