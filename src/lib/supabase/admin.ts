import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. NEVER import this from a
 * Client Component, and never let this key reach the browser bundle
 * (the `server-only` import above makes any client-side import a build error).
 *
 * Legitimate uses only: Stripe/WhatsApp webhook handlers that must act
 * without a logged-in user session, scheduled report jobs, and admin
 * tooling. Every call site here must manually scope queries by tenant_id —
 * there is no RLS safety net once you use this client.
 *
 * Untyped for the same reason as the browser/server clients — see client.ts.
 */
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
