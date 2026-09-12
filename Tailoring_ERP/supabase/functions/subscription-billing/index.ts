// Subscription billing for AtelierHQ itself: shop -> platform, distinct
// from supabase/functions/fincra-checkout (customer -> shop, each tenant's
// OWN Fincra account). This function bills through the PLATFORM's single
// Fincra account — credentials live only in edge-function secrets, never in
// Postgres, and are never per-tenant.
//
// Routes (matched on the path after the function name):
//   POST /subscription-billing/checkout — create a Checkout payment link
//   POST /subscription-billing/webhook  — Fincra -> this function
//
// v1 is manual renewal: the owner clicks Subscribe/Renew, pays, and the
// webhook extends tenants.current_period_end by one plan interval. Fincra's
// only recurring primitive is a NIBSS direct-debit mandate (merchant
// triggered, 24-48h bank approval, no built-in scheduler, Nigerian bank
// accounts only) — auto-renew on that is a separate, larger build, not a
// config flag, and is deliberately out of scope here.
//
// Required edge function secrets:
//   PLATFORM_FINCRA_BUSINESS_ID, PLATFORM_FINCRA_PUBLIC_KEY,
//   PLATFORM_FINCRA_SECRET_KEY, PLATFORM_FINCRA_WEBHOOK_SECRET,
//   PLATFORM_FINCRA_LIVE ("true"/"false")
// APP_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already set for
// every edge function in this project (see fincra-checkout).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "";
const FINCRA_BUSINESS_ID = Deno.env.get("PLATFORM_FINCRA_BUSINESS_ID") ?? "";
const FINCRA_PUBLIC_KEY = Deno.env.get("PLATFORM_FINCRA_PUBLIC_KEY") ?? "";
const FINCRA_SECRET_KEY = Deno.env.get("PLATFORM_FINCRA_SECRET_KEY") ?? "";
const FINCRA_WEBHOOK_SECRET =
  Deno.env.get("PLATFORM_FINCRA_WEBHOOK_SECRET") ?? "";
const FINCRA_LIVE = Deno.env.get("PLATFORM_FINCRA_LIVE") === "true";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCallerTenant(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(
    "Bearer ",
    "",
  );
  const { data: userData, error: userError } = await admin.auth.getUser(
    token,
  );
  if (userError || !userData.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userData.user.id)
    .single();
  if (!profile) return null;

  const { data: tenant } = await admin
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single();
  if (!tenant) return null;

  return { tenant, role: profile.role as string, email: userData.user.email };
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handleCheckout(req: Request) {
  const caller = await getCallerTenant(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (caller.role !== "owner") {
    return json({ error: "Only the shop owner can manage billing" }, 403);
  }
  if (!caller.email) {
    return json(
      { error: "Your account has no email on file — add one before subscribing." },
      400,
    );
  }

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("code")
    .limit(1)
    .maybeSingle();
  if (planError || !plan) {
    return json({ error: "No active plan is configured" }, 500);
  }

  const reference = `sub-${caller.tenant.id}-${crypto.randomUUID()}`;
  const baseUrl = FINCRA_LIVE
    ? "https://api.fincra.com"
    : "https://sandboxapi.fincra.com";

  const fincraRes = await fetch(`${baseUrl}/checkout/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": FINCRA_SECRET_KEY,
      "x-pub-key": FINCRA_PUBLIC_KEY,
      "x-business-id": FINCRA_BUSINESS_ID,
    },
    body: JSON.stringify({
      currency: plan.currency,
      amount: plan.amount,
      customer: {
        name: caller.tenant.name,
        email: caller.email,
      },
      reference,
      redirectUrl: `${APP_URL}/billing?status=return`,
      metadata: { tenantId: caller.tenant.id, planCode: plan.code },
    }),
  });

  const fincraBody = await fincraRes.json();
  if (!fincraRes.ok || !fincraBody?.data?.link) {
    console.error("Fincra subscription checkout failed", fincraBody);
    return json(
      { error: fincraBody?.message ?? "Checkout could not be created" },
      502,
    );
  }

  return json({ url: fincraBody.data.link });
}

async function handleWebhook(req: Request) {
  const signature = req.headers.get("signature");
  const rawBody = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  const expectedSignature = await hmacSha512Hex(
    FINCRA_WEBHOOK_SECRET,
    rawBody,
  );
  if (!safeEqual(expectedSignature, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const reference = payload.data?.reference as string | undefined;
  const tenantId = reference?.match(
    /^sub-([0-9a-fA-F-]{36})-/,
  )?.[1];
  if (!tenantId) return json({ received: true }); // not a reference we generated

  if (
    payload.event === "charge.successful" &&
    payload.data?.status === "success"
  ) {
    const planCode = (
      (payload.data.metadata as Record<string, unknown> | undefined)
        ?.planCode as string | undefined
    ) ?? "standard";
    const amount = Number(payload.data.amount ?? 0);
    const currency = (payload.data.currency as string | undefined) ?? "";

    const { data: plan } = await admin
      .from("plans")
      .select("interval_days")
      .eq("code", planCode)
      .maybeSingle();

    const { data: applied, error } = await admin.rpc(
      "apply_subscription_payment",
      {
        p_tenant_id: tenantId,
        p_plan_code: planCode,
        p_amount: amount,
        p_currency: currency,
        p_reference: reference,
        p_interval_days: plan?.interval_days ?? 30,
      },
    );
    if (error) {
      console.error("apply_subscription_payment failed", error);
      return json({ error: "Failed to apply payment" }, 500);
    }
    if (!applied) {
      // Already-processed reference — idempotent no-op, not an error.
      return json({ received: true, duplicate: true });
    }
  }

  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith("/checkout")) return await handleCheckout(req);
    if (path.endsWith("/webhook")) return await handleWebhook(req);
    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
