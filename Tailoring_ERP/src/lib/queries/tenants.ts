import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type { Tenant, UserRole } from "../supabase/types.ts";
import { useSession } from "../../components/providers/auth.tsx";

function mapTenant(row: Record<string, unknown>, role?: UserRole): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    address: (row.address as string) ?? null,
    currency: row.currency as string,
    role,
    stripeConnectAccountId: (row.stripe_connect_account_id as string) ?? null,
    stripeOnboardingStatus: (row.stripe_onboarding_status as Tenant["stripeOnboardingStatus"]) ?? "not_started",
    stripeCountry: (row.stripe_country as string) ?? null,
    stripeDefaultCurrency: (row.stripe_default_currency as string) ?? null,
  };
}

/** Mirrors Convex's getMyTenant: null while no shop exists yet, undefined while loading. */
export function useMyTenant(): Tenant | null | undefined {
  const { session, status: sessionStatus } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["tenant", userId],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, tenants!profiles_tenant_id_fkey(*)")
        .eq("id", userId!)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || !profile.tenants) return null;
      return mapTenant(profile.tenants as unknown as Record<string, unknown>, profile.role as UserRole);
    },
    enabled: !!userId,
  });

  if (sessionStatus === "loading" || (userId && query.isLoading)) return undefined;
  if (!userId) return null;
  return query.data ?? null;
}

export function useCreateTenant() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { name: string; phone?: string; address?: string; currency: string }) => {
      const { data, error } = await supabase.rpc("create_tenant_for_current_user", {
        p_name: input.name,
        p_phone: input.phone ?? null,
        p_address: input.address ?? null,
        p_currency: input.currency,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
  return mutateAsync;
}

// ── Stripe Connect ────────────────────────────────────────────────────────────
// All three routes live in the single `stripe-connect` edge function — see
// supabase/functions/stripe-connect. The platform's Stripe secret key never
// leaves that function; the client only ever gets back a URL or a status.

/** Starts (or resumes) this tenant's Stripe Express onboarding — returns the
 *  Stripe-hosted URL to redirect the browser to. */
export function useConnectStripe() {
  return async () => {
    const { data, error } = await supabase.functions.invoke("stripe-connect/create-account-link");
    if (error) throw error;
    return (data as { url: string }).url;
  };
}

/** Re-syncs stripeOnboardingStatus/country/currency from the live Stripe
 *  Account object — call this when the user returns from Stripe onboarding. */
export function useRefreshStripeStatus() {
  const qc = useQueryClient();
  return async () => {
    const { error } = await supabase.functions.invoke("stripe-connect/account-status");
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["tenant"] });
  };
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { name?: string; phone?: string; address?: string; currency?: string }) => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user!.id)
        .single();
      if (profileError) throw profileError;

      const { error } = await supabase.from("tenants").update(input).eq("id", profile.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
  return mutateAsync;
}
