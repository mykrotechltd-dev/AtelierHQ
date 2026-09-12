import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import { useSession } from "../../components/providers/auth.tsx";
import type {
  BillingPlan,
  BillingState,
  SubscriptionInvoice,
} from "../supabase/types.ts";

function mapPlan(row: Record<string, unknown>): BillingPlan {
  return {
    code: row.code as string,
    name: row.name as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    intervalDays: row.interval_days as number,
  };
}

// Shop -> platform subscription billing (supabase/functions/subscription-billing),
// distinct from queries/tenants.ts's Fincra hooks, which are each shop's OWN
// Fincra account for taking payments from ITS customers. Enforcement itself
// lives in Postgres (tenant_can_write(), the RLS policies and RPC guards in
// 0006_subscription_billing.sql) — this hook is read-only UX, not the gate.

function mapInvoice(row: Record<string, unknown>): SubscriptionInvoice {
  return {
    id: row.id as string,
    planCode: (row.plan_code as string) ?? null,
    amount: Number(row.amount),
    currency: row.currency as string,
    status: row.status as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    paidAt: row.paid_at as string,
  };
}

export function useBillingState(): BillingState | undefined {
  const { session } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["billingState", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tenant_billing_state");
      if (error) throw error;
      return data as BillingState;
    },
    enabled: !!userId,
  });
  return query.data;
}

export function useRefreshBillingState() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["billingState"] });
}

/** Every plan a shop can subscribe to, cheapest first. Plain select (not an
 *  RPC) — the plans_select RLS policy already allows any authenticated read,
 *  and there's nothing tenant-scoped about a price list. */
export function useActivePlans(): BillingPlan[] | undefined {
  const { session } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("code, name, amount, currency, interval_days")
        .eq("is_active", true)
        .order("amount", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapPlan);
    },
    enabled: !!userId,
  });
  return query.data;
}

export function useSubscriptionInvoices(): SubscriptionInvoice[] | undefined {
  const { session } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["subscriptionInvoices", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select("id, plan_code, amount, currency, status, period_start, period_end, paid_at")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapInvoice);
    },
    enabled: !!userId,
  });
  return query.data;
}

/** Redirects the browser to a Fincra-hosted checkout for the given plan.
 *  The resulting subscription only ever becomes active via the webhook —
 *  never from this call directly — so an abandoned checkout changes nothing. */
export function useStartSubscriptionCheckout() {
  return async (planCode: string) => {
    const { data, error } = await supabase.functions.invoke(
      "subscription-billing/checkout",
      { body: { planCode } },
    );
    if (error) throw error;
    return (data as { url: string }).url;
  };
}
