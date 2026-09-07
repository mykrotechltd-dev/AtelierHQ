import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type { FincraSettingsPublic, Tenant, UserRole } from "../supabase/types.ts";
import { useSession } from "../../components/providers/auth.tsx";

function mapTenant(row: Record<string, unknown>, role?: UserRole): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    address: (row.address as string) ?? null,
    currency: row.currency as string,
    role,
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

// ── Fincra ──────────────────────────────────────────────────────────────────
// Each tenant connects its own Fincra business account directly (there's no
// confirmed public API for this platform to create per-tenant sub-accounts
// the way Stripe Connect did). Credentials are written via set_fincra_settings
// and never read back — see supabase/migrations/0003_fincra.sql.

/** This tenant's Fincra connection, or null if nothing has been saved yet —
 *  never carries the secret key or webhook secret. */
export function useFincraSettings(): FincraSettingsPublic | null | undefined {
  const { session } = useSession();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: ["fincraSettings", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_fincra_settings_public");
      if (error) throw error;
      return (data as FincraSettingsPublic | null) ?? null;
    },
    enabled: !!userId,
  });
  return query.isLoading ? undefined : (query.data ?? null);
}

export function useSetFincraSettings() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { businessId: string; publicKey: string; secretKey: string; webhookSecret: string; isLive: boolean }) => {
      const { error } = await supabase.rpc("set_fincra_settings", {
        p_business_id: input.businessId,
        p_public_key: input.publicKey,
        p_secret_key: input.secretKey,
        p_webhook_secret: input.webhookSecret,
        p_is_live: input.isLive,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fincraSettings"] }),
  });
  return mutateAsync;
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
