import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  tenantId: string;
  tenantName: string;
  fullName: string;
  role: "owner" | "admin" | "staff" | "worker";
};

/**
 * Resolves the logged-in user's profile + tenant for use in Server
 * Components and Server Actions. Redirects to /login if there is no
 * session, and to /onboarding if the auth user exists but hasn't finished
 * tenant setup yet (edge case: signup succeeded but onboarding was
 * interrupted before create_tenant_for_current_user() ran).
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Explicit relationship hint required: profiles.tenant_id -> tenants.id and
  // tenants.owner_id -> profiles.id are two separate FK paths between these
  // two tables, so PostgREST can't auto-resolve a bare `tenants(name)` embed
  // (it silently errors, which was previously causing a dashboard<->onboarding
  // redirect loop for every logged-in user).
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, tenant_id, tenants!profiles_tenant_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/onboarding");
  }

  return {
    id: profile.id,
    tenantId: profile.tenant_id,
    // @ts-expect-error — loosened until database.types.ts is generated from the real schema
    tenantName: profile.tenants?.name ?? "",
    fullName: profile.full_name,
    role: profile.role,
  };
}

export function requireRole(user: CurrentUser, allowed: CurrentUser["role"][]) {
  if (!allowed.includes(user.role)) {
    throw new Error("Forbidden: insufficient role for this action");
  }
}
