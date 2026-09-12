import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type {
  AdminClientRow,
  AdminDashboardStats,
  AdminFittingRow,
  AdminDeliveryRow,
  AdminInventoryRow,
  AdminOrderRow,
  AdminSearchResult,
  AdminStaffRow,
} from "../supabase/admin-types.ts";
import { usePaginatedQuery } from "./pagination.ts";

// Every admin read below calls a security-definer RPC
// (supabase/migrations/0005_admin_audit_scoped_access.sql) rather than
// selecting a table directly — there is no `_admin_select` RLS policy on
// any tenant table, so this is the only path a platform-admin session has
// to cross-tenant data, and each call is logged server-side (admin_access_log)
// with who read what and how many rows came back.

// ── Dashboard ────────────────────────────────────────────────────────────

export function useAdminDashboardStats(): AdminDashboardStats | undefined {
  const query = useQuery({
    queryKey: ["admin", "dashboardStats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_platform_admin_dashboard_stats",
      );
      if (error) throw error;
      return data as AdminDashboardStats;
    },
  });
  return query.data;
}

// ── Orders ───────────────────────────────────────────────────────────────

export function useAdminOrders(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminOrderRow>(
    ["admin", "orders", search ?? ""],
    async (offset, limit) => {
      const { data, error } = await supabase.rpc("admin_list_orders", {
        p_search: search ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return (data as AdminOrderRow[]) ?? [];
    },
    pageSize,
  );
}

// ── Clients ──────────────────────────────────────────────────────────────

export function useAdminClients(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminClientRow>(
    ["admin", "clients", search ?? ""],
    async (offset, limit) => {
      const { data, error } = await supabase.rpc("admin_list_clients", {
        p_search: search ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return (data as AdminClientRow[]) ?? [];
    },
    pageSize,
  );
}

// ── Schedule (fittings + deliveries for a date range) ───────────────────

/** rangeStart/rangeEnd are ISO date strings (YYYY-MM-DD), end-exclusive. */
export function useAdminSchedule(rangeStart: string, rangeEnd: string) {
  const query = useQuery({
    queryKey: ["admin", "schedule", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_schedule", {
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
      });
      if (error) throw error;
      const result = data as {
        fittings: AdminFittingRow[];
        deliveries: AdminDeliveryRow[];
      };
      return { fittings: result.fittings, deliveries: result.deliveries };
    },
  });
  return query.data;
}

// ── Inventory ────────────────────────────────────────────────────────────

export function useAdminInventory(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminInventoryRow>(
    ["admin", "inventory", search ?? ""],
    async (offset, limit) => {
      const { data, error } = await supabase.rpc("admin_list_inventory", {
        p_search: search ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return (data as AdminInventoryRow[]) ?? [];
    },
    pageSize,
  );
}

// ── Staff ────────────────────────────────────────────────────────────────

export function useAdminStaff(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminStaffRow>(
    ["admin", "staff", search ?? ""],
    async (offset, limit) => {
      const { data, error } = await supabase.rpc("admin_list_staff", {
        p_search: search ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return (data as AdminStaffRow[]) ?? [];
    },
    pageSize,
  );
}

// ── Header quick search (orders + clients) ─────────────────────────────

export function useAdminQuickSearch(term: string) {
  const trimmed = term.trim();
  const query = useQuery({
    queryKey: ["admin", "quickSearch", trimmed],
    queryFn: async (): Promise<AdminSearchResult[]> => {
      const { data, error } = await supabase.rpc("admin_quick_search", {
        p_term: trimmed,
      });
      if (error) throw error;
      return (data as AdminSearchResult[]) ?? [];
    },
    enabled: trimmed.length > 0,
  });
  return query.data ?? [];
}
