import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type { Measurements, OrderStatus } from "../supabase/types.ts";
import type {
  AdminClientRow,
  AdminDashboardStats,
  AdminDeliveryRow,
  AdminFittingRow,
  AdminInventoryRow,
  AdminOrderRow,
  AdminSearchResult,
  AdminStaffRow,
  FittingStatus,
  InventoryCategory,
} from "../supabase/admin-types.ts";
import { usePaginatedQuery } from "./pagination.ts";

function tenantNameOf(row: Record<string, unknown>): string {
  const tenant = row.tenants as unknown as { name: string } | null;
  return tenant?.name ?? "Unknown shop";
}

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

function mapAdminOrder(row: Record<string, unknown>): AdminOrderRow {
  const customer = row.customers as unknown as { name: string } | null;
  const items =
    (row.order_items as unknown as { garment_type: string | null }[]) ?? [];
  const garmentTypes = Array.from(
    new Set(items.map((i) => i.garment_type).filter((g): g is string => !!g)),
  );
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    tenantName: tenantNameOf(row),
    orderNumber: row.order_number as string,
    status: row.status as OrderStatus,
    dueDate: (row.due_date as string) ?? null,
    totalAmount: Number(row.total_amount),
    customerName: customer?.name ?? "Unknown",
    garmentTypes,
  };
}

export function useAdminOrders(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminOrderRow>(
    ["admin", "orders", search ?? ""],
    async (offset, limit) => {
      let query = supabase
        .from("orders")
        .select("*, customers(name), tenants(name), order_items(garment_type)");
      if (search && search.trim()) {
        query = query.ilike("order_number", `%${search.trim()}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map(mapAdminOrder);
    },
    pageSize,
  );
}

// ── Clients ──────────────────────────────────────────────────────────────

function mapAdminClient(row: Record<string, unknown>): AdminClientRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    tenantName: tenantNameOf(row),
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    measurements: (row.measurements as Measurements) ?? null,
  };
}

export function useAdminClients(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminClientRow>(
    ["admin", "clients", search ?? ""],
    async (offset, limit) => {
      let query = supabase.from("customers").select("*, tenants(name)");
      if (search && search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map(mapAdminClient);
    },
    pageSize,
  );
}

// ── Schedule (fittings + deliveries for a date range) ───────────────────

function mapAdminFitting(row: Record<string, unknown>): AdminFittingRow {
  const customer = row.customers as unknown as { name: string } | null;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    tenantName: tenantNameOf(row),
    customerName: customer?.name ?? "Unknown",
    scheduledAt: row.scheduled_at as string,
    status: row.status as FittingStatus,
    notes: (row.notes as string) ?? null,
  };
}

function mapAdminDelivery(row: Record<string, unknown>): AdminDeliveryRow {
  const customer = row.customers as unknown as { name: string } | null;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    tenantName: tenantNameOf(row),
    orderNumber: row.order_number as string,
    customerName: customer?.name ?? "Unknown",
    dueDate: row.due_date as string,
    status: row.status as OrderStatus,
  };
}

/** rangeStart/rangeEnd are ISO date strings (YYYY-MM-DD), end-exclusive. */
export function useAdminSchedule(rangeStart: string, rangeEnd: string) {
  const query = useQuery({
    queryKey: ["admin", "schedule", rangeStart, rangeEnd],
    queryFn: async () => {
      const [fittingsRes, deliveriesRes] = await Promise.all([
        supabase
          .from("fittings")
          .select("*, customers(name), tenants(name)")
          .gte("scheduled_at", rangeStart)
          .lt("scheduled_at", rangeEnd)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("orders")
          .select("*, customers(name), tenants(name)")
          .gte("due_date", rangeStart)
          .lt("due_date", rangeEnd)
          .order("due_date", { ascending: true }),
      ]);
      if (fittingsRes.error) throw fittingsRes.error;
      if (deliveriesRes.error) throw deliveriesRes.error;
      return {
        fittings: (fittingsRes.data ?? []).map(mapAdminFitting),
        deliveries: (deliveriesRes.data ?? []).map(mapAdminDelivery),
      };
    },
  });
  return query.data;
}

// ── Inventory ────────────────────────────────────────────────────────────

function mapAdminInventory(row: Record<string, unknown>): AdminInventoryRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    tenantName: tenantNameOf(row),
    name: row.name as string,
    category: row.category as InventoryCategory,
    unit: row.unit as string,
    quantityOnHand: Number(row.quantity_on_hand),
    reorderThreshold: Number(row.reorder_threshold),
  };
}

export function useAdminInventory(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminInventoryRow>(
    ["admin", "inventory", search ?? ""],
    async (offset, limit) => {
      let query = supabase.from("inventory_items").select("*, tenants(name)");
      if (search && search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      const { data, error } = await query
        .order("quantity_on_hand", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map(mapAdminInventory);
    },
    pageSize,
  );
}

// ── Staff ────────────────────────────────────────────────────────────────

function mapAdminStaff(row: Record<string, unknown>): AdminStaffRow {
  const tasks =
    (row.tasks as unknown as { status: string; description: string }[]) ?? [];
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    tenantName: tenantNameOf(row),
    name: row.name as string,
    specialization: (row.specialization as string) ?? null,
    isActive: row.is_active as boolean,
    pendingTasks: tasks.filter((t) => t.status === "pending").length,
    inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
    doneTasks: tasks.filter((t) => t.status === "done").length,
    activeTaskDescriptions: tasks
      .filter((t) => t.status !== "done")
      .map((t) => t.description)
      .slice(0, 3),
  };
}

export function useAdminStaff(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<AdminStaffRow>(
    ["admin", "staff", search ?? ""],
    async (offset, limit) => {
      let query = supabase
        .from("workers")
        .select("*, tenants(name), tasks(status, description)");
      if (search && search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map(mapAdminStaff);
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
      const [ordersRes, clientsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, tenant_id, tenants(name), customers(name)")
          .ilike("order_number", `%${trimmed}%`)
          .limit(5),
        supabase
          .from("customers")
          .select("id, name, tenant_id, tenants(name)")
          .ilike("name", `%${trimmed}%`)
          .limit(5),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (clientsRes.error) throw clientsRes.error;

      const orders: AdminSearchResult[] = (ordersRes.data ?? []).map(
        (row) => {
          const r = row as unknown as Record<string, unknown>;
          const customer = r.customers as unknown as { name: string } | null;
          return {
            kind: "order",
            id: r.id as string,
            tenantId: r.tenant_id as string,
            tenantName: tenantNameOf(r),
            title: r.order_number as string,
            subtitle: customer?.name ?? "",
          };
        },
      );
      const clients: AdminSearchResult[] = (clientsRes.data ?? []).map(
        (row) => {
          const r = row as unknown as Record<string, unknown>;
          return {
            kind: "client",
            id: r.id as string,
            tenantId: r.tenant_id as string,
            tenantName: tenantNameOf(r),
            title: r.name as string,
            subtitle: "Client",
          };
        },
      );
      return [...orders, ...clients];
    },
    enabled: trimmed.length > 0,
  });
  return query.data ?? [];
}
