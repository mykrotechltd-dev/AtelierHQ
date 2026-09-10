import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type {
  Customer,
  Measurements,
  Order,
  OrderItem,
  OrderMaterial,
  OrderStatus,
} from "../supabase/types.ts";
import { usePaginatedQuery } from "./pagination.ts";

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    customerId: row.customer_id as string,
    orderNumber: row.order_number as string,
    status: row.status as OrderStatus,
    dueDate: (row.due_date as string) ?? null,
    totalAmount: Number(row.total_amount),
    notes: (row.notes as string) ?? null,
  };
}

function mapOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    tenantId: row.tenant_id as string,
    description: row.description as string,
    garmentType: (row.garment_type as string) ?? null,
    fabric: (row.fabric as string) ?? null,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    notes: (row.notes as string) ?? null,
    measurements: (row.measurements as Measurements) ?? null,
  };
}

function mapOrderMaterial(row: Record<string, unknown>): OrderMaterial {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    orderItemId: row.order_item_id as string,
    name: row.name as string,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  };
}

export function useOrders(status: OrderStatus | undefined, pageSize = 20) {
  return usePaginatedQuery<Order & { customerName: string }>(
    ["orders", status ?? ""],
    async (offset, limit) => {
      let query = supabase.from("orders").select("*, customers(name)");
      if (status) query = query.eq("status", status);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...mapOrder(row),
        customerName:
          (row.customers as unknown as { name: string } | null)?.name ??
          "Unknown",
      }));
    },
    pageSize,
  );
}

export type OrderItemWithMaterials = OrderItem & {
  materials: OrderMaterial[];
  materialCostTotal: number;
};

export function useOrder(id: string | undefined):
  | (Order & {
      customer: Customer | null;
      items: OrderItemWithMaterials[];
      materialCostTotal: number;
    })
  | null
  | undefined {
  const query = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data: orderRow, error } = await supabase
        .from("orders")
        .select("*, customers(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;

      const { data: itemRows, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id!);
      if (itemsError) throw itemsError;

      const itemIds = (itemRows ?? []).map((r) => r.id as string);
      const { data: materialRows, error: materialsError } = itemIds.length
        ? await supabase
            .from("order_materials")
            .select("*")
            .in("order_item_id", itemIds)
        : { data: [], error: null };
      if (materialsError) throw materialsError;

      const materialsByItem = new Map<string, OrderMaterial[]>();
      for (const row of materialRows ?? []) {
        const material = mapOrderMaterial(row);
        const list = materialsByItem.get(material.orderItemId) ?? [];
        list.push(material);
        materialsByItem.set(material.orderItemId, list);
      }

      const items: OrderItemWithMaterials[] = (itemRows ?? []).map((row) => {
        const materials = materialsByItem.get(row.id as string) ?? [];
        return {
          ...mapOrderItem(row),
          materials,
          materialCostTotal: materials.reduce((sum, m) => sum + m.lineTotal, 0),
        };
      });

      const customerRow = orderRow.customers as unknown as Record<
        string,
        unknown
      > | null;
      return {
        ...mapOrder(orderRow),
        customer: customerRow
          ? {
              id: customerRow.id as string,
              tenantId: customerRow.tenant_id as string,
              name: customerRow.name as string,
              phone: (customerRow.phone as string) ?? null,
              email: (customerRow.email as string) ?? null,
              notes: (customerRow.notes as string) ?? null,
              measurements:
                customerRow.measurements as Customer["measurements"],
            }
          : null,
        items,
        materialCostTotal: items.reduce(
          (sum, item) => sum + item.materialCostTotal,
          0,
        ),
      };
    },
    enabled: !!id,
  });
  if (!id) return undefined;
  return query.isLoading ? undefined : (query.data ?? null);
}

export function useCreateOrder() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      customerId: string;
      dueDate?: string;
      notes?: string;
      items: {
        description: string;
        garmentType?: string;
        fabric?: string;
        quantity: number;
        unitPrice: number;
        notes?: string;
        measurements?: Measurements;
      }[];
    }) => {
      const { data, error } = await supabase.rpc("create_order_with_items", {
        p_customer_id: input.customerId,
        p_due_date: input.dueDate ?? null,
        p_notes: input.notes ?? null,
        p_items: input.items,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
  return mutateAsync;
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      id: string;
      dueDate?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("orders")
        .update({ due_date: input.dueDate ?? null, notes: input.notes ?? null })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", v.id] });
    },
  });
  return mutateAsync;
}

export function useAdvanceOrderStatus() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.rpc("advance_order_status", {
        p_order_id: input.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", v.id] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
  return mutateAsync;
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
  return mutateAsync;
}

export function useAddOrderItem() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      orderId: string;
      description: string;
      garmentType?: string;
      fabric?: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
      measurements?: Measurements;
    }) => {
      const { data, error } = await supabase
        .from("order_items")
        .insert({
          order_id: input.orderId,
          description: input.description,
          garment_type: input.garmentType ?? null,
          fabric: input.fabric ?? null,
          quantity: input.quantity,
          unit_price: input.unitPrice,
          notes: input.notes ?? null,
          measurements: input.measurements ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["order", v.orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  return mutateAsync;
}

export function useUpdateOrderItem() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      id: string;
      description?: string;
      garmentType?: string;
      fabric?: string;
      quantity?: number;
      unitPrice?: number;
      notes?: string;
      measurements?: Measurements;
    }) => {
      const { id, garmentType, unitPrice, measurements, ...rest } = input;
      const { data, error } = await supabase
        .from("order_items")
        .update({
          ...rest,
          ...(garmentType !== undefined ? { garment_type: garmentType } : {}),
          ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
          ...(measurements !== undefined ? { measurements } : {}),
        })
        .eq("id", id)
        .select("order_id")
        .single();
      if (error) throw error;
      return data.order_id as string;
    },
    onSuccess: (orderId) => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  return mutateAsync;
}

export function useAddMaterial() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      orderId: string;
      orderItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }) => {
      const { error } = await supabase.from("order_materials").insert({
        order_item_id: input.orderItemId,
        name: input.name,
        quantity: input.quantity,
        unit_price: input.unitPrice,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["order", v.orderId] }),
  });
  return mutateAsync;
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      id: string;
      orderId: string;
      name?: string;
      quantity?: number;
      unitPrice?: number;
    }) => {
      const { id, orderId: _orderId, unitPrice, ...rest } = input;
      const { error } = await supabase
        .from("order_materials")
        .update({
          ...rest,
          ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["order", v.orderId] }),
  });
  return mutateAsync;
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string; orderId: string }) => {
      const { error } = await supabase
        .from("order_materials")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["order", v.orderId] }),
  });
  return mutateAsync;
}

export function useDeleteOrderItem() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { data, error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", input.id)
        .select("order_id")
        .single();
      if (error) throw error;
      return data.order_id as string;
    },
    onSuccess: (orderId) => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  return mutateAsync;
}
