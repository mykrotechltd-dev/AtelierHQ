import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type { Payment, PaymentMethod } from "../supabase/types.ts";
import { usePaginatedQuery } from "./pagination.ts";

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    customerId: row.customer_id as string,
    orderId: row.order_id as string,
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    notes: (row.notes as string) ?? null,
    paidAt: row.paid_at as string,
    externalReference: (row.external_reference as string) ?? null,
    chargedCurrency: (row.charged_currency as string) ?? null,
    chargedAmount:
      row.charged_amount === null || row.charged_amount === undefined
        ? null
        : Number(row.charged_amount),
  };
}

export function usePayments(pageSize = 20) {
  return usePaginatedQuery<
    Payment & { customerName: string; orderNumber: string; orderTotal: number }
  >(
    ["payments"],
    async (offset, limit) => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, customers(name), orders(order_number, total_amount)")
        .order("paid_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...mapPayment(row),
        customerName:
          (row.customers as unknown as { name: string } | null)?.name ??
          "Unknown",
        orderNumber:
          (row.orders as unknown as { order_number: string } | null)
            ?.order_number ?? "—",
        orderTotal: Number(
          (row.orders as unknown as { total_amount: number } | null)
            ?.total_amount ?? 0,
        ),
      }));
    },
    pageSize,
  );
}

export function usePaymentsByOrder(orderId: string | undefined):
  | {
      payments: Payment[];
      totalPaid: number;
      outstanding: number;
      overpaid: boolean;
      orderTotal: number;
    }
  | undefined {
  const query = useQuery({
    queryKey: ["paymentsByOrder", orderId],
    queryFn: async () => {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("id", orderId!)
        .single();
      if (orderError) throw orderError;

      const { data: paymentRows, error } = await supabase
        .from("payments")
        .select("*")
        .eq("order_id", orderId!)
        .order("paid_at", { ascending: false });
      if (error) throw error;

      const payments = (paymentRows ?? []).map(mapPayment);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const orderTotal = Number(order.total_amount);
      return {
        payments,
        totalPaid,
        outstanding: Math.max(0, orderTotal - totalPaid),
        overpaid: totalPaid > orderTotal,
        orderTotal,
      };
    },
    enabled: !!orderId,
  });
  if (!orderId) return undefined;
  return query.isLoading ? undefined : query.data;
}

export function useOutstandingSummary() {
  const query = useQuery({
    queryKey: ["outstandingSummary"],
    queryFn: async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, total_amount");
      if (ordersError) throw ordersError;
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("order_id, amount");
      if (paymentsError) throw paymentsError;

      const paidByOrder = new Map<string, number>();
      for (const p of payments ?? []) {
        paidByOrder.set(
          p.order_id,
          (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount),
        );
      }

      let totalBilled = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let ordersWithBalance = 0;
      for (const o of orders ?? []) {
        const paid = paidByOrder.get(o.id) ?? 0;
        const total = Number(o.total_amount);
        const outstanding = Math.max(0, total - paid);
        totalBilled += total;
        totalCollected += Math.min(paid, total);
        totalOutstanding += outstanding;
        if (outstanding > 0) ordersWithBalance++;
      }
      return {
        totalBilled,
        totalCollected,
        totalOutstanding,
        ordersWithBalance,
      };
    },
  });
  return query.isLoading ? undefined : query.data;
}

export function useRecordPayment() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      orderId: string;
      amount: number;
      method: PaymentMethod;
      notes?: string;
      paidAt: string;
    }) => {
      const { data, error } = await supabase.rpc("record_payment", {
        p_order_id: input.orderId,
        p_amount: input.amount,
        p_method: input.method,
        p_notes: input.notes ?? null,
        p_paid_at: input.paidAt,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["paymentsByOrder", v.orderId] });
      qc.invalidateQueries({ queryKey: ["order", v.orderId] });
      qc.invalidateQueries({ queryKey: ["outstandingSummary"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
  return mutateAsync;
}

/** Creates a Fincra checkout on this tenant's own connected Fincra business
 *  account and returns the hosted URL to redirect to. The resulting
 *  `payments` row is created only by the webhook on success — never by the
 *  client, so an abandoned checkout leaves no record. */
export function useCreateFincraCheckout() {
  return async (input: { orderId: string; amount: number }) => {
    const { data, error } = await supabase.functions.invoke(
      "fincra-checkout/initiate",
      {
        body: { orderId: input.orderId, amount: input.amount },
      },
    );
    if (error) throw error;
    return (data as { url: string }).url;
  };
}

export function useDeletePayment() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { data, error } = await supabase
        .from("payments")
        .delete()
        .eq("id", input.id)
        .select("order_id")
        .single();
      if (error) throw error;
      return data.order_id as string;
    },
    onSuccess: (orderId) => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["paymentsByOrder", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["outstandingSummary"] });
    },
  });
  return mutateAsync;
}
