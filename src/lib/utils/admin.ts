import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type PlatformAdmin = { id: string; email: string };

/**
 * Gate for everything under /admin. Two-step, both server-side:
 *  1. Resolve the caller's identity from their session cookie (the normal,
 *     RLS-scoped client — nothing privileged yet).
 *  2. Ask is_platform_admin() (SECURITY DEFINER, reads platform_admins) whether
 *     *that specific user* is a platform admin.
 *
 * Only after both checks pass do /admin pages reach for the service-role
 * client to run cross-tenant queries — see src/lib/supabase/admin.ts. This
 * is the same pattern the Stripe webhook uses: verify who's asking first,
 * bypass RLS second, never the other way around.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return { id: user.id, email: user.email ?? "" };
}
