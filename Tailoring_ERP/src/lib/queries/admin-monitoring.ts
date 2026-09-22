import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type {
  AdminActivityEvent,
  AdminAuditEntry,
  AdminNotification,
  AdminPlatformOverview,
  AdminRecentPayment,
  AdminTenantHealth,
} from "../supabase/admin-monitoring-types.ts";

// Every read here calls an audited, security-definer function from
// supabase/migrations/0008_activity_and_audit.sql. If that migration has not
// been applied yet the call fails, and each hook reports isError so the page
// can say so instead of showing an empty state that looks like "no data".

interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

function state<T>(q: {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}): QueryState<T> {
  return {
    data: q.data,
    isLoading: q.isLoading,
    isError: q.isError,
    retry: () => {
      void q.refetch();
    },
  };
}

export function useAdminOverview(): QueryState<AdminPlatformOverview> {
  return state(
    useQuery({
      queryKey: ["admin", "overview"],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("admin_platform_overview");
        if (error) throw error;
        return data as AdminPlatformOverview;
      },
      retry: false,
    }),
  );
}

export function useAdminTenantHealth(): QueryState<
  Record<string, AdminTenantHealth>
> {
  return state(
    useQuery({
      queryKey: ["admin", "tenantHealth"],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("admin_tenant_health");
        if (error) throw error;
        const byId: Record<string, AdminTenantHealth> = {};
        for (const row of data as AdminTenantHealth[]) byId[row.tenantId] = row;
        return byId;
      },
      retry: false,
    }),
  );
}

export function useAdminRecentPayments(
  limit = 10,
): QueryState<AdminRecentPayment[]> {
  return state(
    useQuery({
      queryKey: ["admin", "recentPayments", limit],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("admin_recent_payments", {
          p_limit: limit,
        });
        if (error) throw error;
        return data as AdminRecentPayment[];
      },
      retry: false,
    }),
  );
}

export function useAdminAuditLog(limit = 100): QueryState<AdminAuditEntry[]> {
  return state(
    useQuery({
      queryKey: ["admin", "auditLog", limit],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("admin_list_audit_log", {
          p_limit: limit,
          p_offset: 0,
        });
        if (error) throw error;
        return data as AdminAuditEntry[];
      },
      retry: false,
    }),
  );
}

export function useAdminNotifications(
  limit = 100,
): QueryState<AdminNotification[]> {
  return state(
    useQuery({
      queryKey: ["admin", "notifications", limit],
      queryFn: async () => {
        const { data, error } = await supabase.rpc(
          "admin_list_notifications",
          { p_limit: limit },
        );
        if (error) throw error;
        return data as AdminNotification[];
      },
      retry: false,
    }),
  );
}

export interface ActivityFilters {
  category?: string;
  tenantId?: string;
  search?: string;
}

async function fetchActivity(
  filters: ActivityFilters,
  after: number | null,
  limit: number,
): Promise<AdminActivityEvent[]> {
  const { data, error } = await supabase.rpc("admin_list_activity", {
    p_category: filters.category || null,
    p_tenant: filters.tenantId || null,
    p_search: filters.search || null,
    p_after: after,
    p_limit: limit,
  });
  if (error) throw error;
  return data as AdminActivityEvent[];
}

/** Activity across every shop. The first load (and each filter change) is a
 *  real, audited read. While `live` is on, a light poll fetches only events
 *  newer than the newest one already shown, which the server does not audit. */
export function useAdminActivity(
  filters: ActivityFilters,
  live: boolean,
): QueryState<AdminActivityEvent[]> {
  const qc = useQueryClient();
  const { category, tenantId, search } = filters;

  const query = useQuery({
    queryKey: ["admin", "activity", category, tenantId, search],
    queryFn: () => fetchActivity({ category, tenantId, search }, null, 100),
    retry: false,
  });

  const loaded = query.data !== undefined;
  useEffect(() => {
    if (!live || !loaded) return;
    const key = ["admin", "activity", category, tenantId, search];
    const timer = setInterval(async () => {
      const newest = qc.getQueryData<AdminActivityEvent[]>(key)?.[0]?.id;
      if (newest === undefined) return;
      try {
        const fresh = await fetchActivity(
          { category, tenantId, search },
          newest,
          50,
        );
        if (fresh.length > 0) {
          qc.setQueryData<AdminActivityEvent[]>(key, (prev) =>
            [...fresh, ...(prev ?? [])].slice(0, 200),
          );
        }
      } catch {
        // A missed poll is harmless; the next tick tries again.
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [live, loaded, qc, category, tenantId, search]);

  return state(query);
}
