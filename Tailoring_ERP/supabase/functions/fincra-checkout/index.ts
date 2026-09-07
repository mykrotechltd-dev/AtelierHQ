// Fincra checkout for AtelierHQ (Tailoring_Shop_ERP).
//
// Replaces the earlier Stripe Connect design: Fincra has no confirmed public
// API for a platform to create per-tenant sub-accounts, so each tenant
// instead connects its OWN Fincra business account directly (credentials
// entered in Settings, stored in fincra_settings — write-only from the
// client, see supabase/migrations/0003_fincra.sql). This function is the
// only thing that ever reads those credentials, via the service-role key.
//
// Routes (matched on the path after the function name):
//   POST /fincra-checkout/initiate — create a Checkout payment link
//   POST /fincra-checkout/webhook  — Fincra -> this function
//
// Fincra API facts this code relies on (confirmed against docs.fincra.com,
// since Fincra's docs are much thinner than Stripe's — verify against the
// live docs again if any of this stops matching reality):
//   - Base URL: https://sandboxapi.fincra.com (test) / https://api.fincra.com (live)
//   - POST /checkout/payments, headers: api-key (secret), x-pub-key (public),
//     x-business-id (business id); body {currency, amount, customer:{name,email},
//     reference, redirectUrl, metadata}; amount is in MAJOR units (e.g. 101.51
//     means ₦101.51, not kobo). Response: { data: { link, reference, payCode } }.
//   - Webhook: header `signature` = hex(HMAC-SHA512(webhook_secret, raw JSON body)).
//     Event `charge.successful` fires for a completed Checkout charge, with
//     `data.reference` echoing back what we sent and `data.status === "success"`.
//
// Required edge function secret: APP_URL (e.g. https://your-app.vercel.app),
// used for the redirect URL after checkout. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically to every edge function.
//
// Manual setup: each tenant registers this function's /webhook URL
// (https://<project>.functions.supabase.co/fincra-checkout/webhook) in
// their OWN Fincra dashboard, and pastes their business ID / public key /
// secret key / webhook secret into this app's Settings page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCallerTenant(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", userData.user.id)
    .single();
  if (!profile) return null;

  const { data: tenant } = await admin.from("tenants").select("*").eq("id", profile.tenant_id).single();
  if (!tenant) return null;

  return { tenant };
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handleInitiate(req: Request) {
  const caller = await getCallerTenant(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const { data: settings } = await admin
    .from("fincra_settings")
    .select("*")
    .eq("tenant_id", caller.tenant.id)
    .maybeSingle();
  if (!settings) return json({ error: "Fincra is not connected for this shop" }, 400);

  const { orderId, amount } = (await req.json()) as { orderId: string; amount: number };
  if (!orderId || !(amount > 0)) return json({ error: "Invalid order or amount" }, 400);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*, customers(name, email)")
    .eq("id", orderId)
    .eq("tenant_id", caller.tenant.id)
    .single();
  if (orderError || !order) return json({ error: "Order not found" }, 404);

  const customer = order.customers as { name: string; email: string | null } | null;
  if (!customer?.email) {
    return json({ error: "This customer has no email on file — add one before taking a card payment." }, 400);
  }

  const { data: existingPayments } = await admin.from("payments").select("amount").eq("order_id", orderId);
  const alreadyPaid = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = Number(order.total_amount) - alreadyPaid;
  if (amount > outstanding) {
    return json({ error: `Amount would exceed the order total. Outstanding: ${outstanding}.` }, 400);
  }

  const reference = `order-${orderId}-${crypto.randomUUID()}`;
  const baseUrl = settings.is_live ? "https://api.fincra.com" : "https://sandboxapi.fincra.com";

  const fincraRes = await fetch(`${baseUrl}/checkout/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": settings.secret_key,
      "x-pub-key": settings.public_key,
      "x-business-id": settings.business_id,
    },
    body: JSON.stringify({
      currency: caller.tenant.currency,
      amount,
      customer: { name: customer.name, email: customer.email },
      reference,
      redirectUrl: `${APP_URL}/orders/${orderId}?fincra=return`,
      metadata: { orderId, tenantId: caller.tenant.id },
    }),
  });

  const fincraBody = await fincraRes.json();
  if (!fincraRes.ok || !fincraBody?.data?.link) {
    console.error("Fincra initiate failed", fincraBody);
    return json({ error: fincraBody?.message ?? "Fincra checkout could not be created" }, 502);
  }

  return json({ url: fincraBody.data.link });
}

async function handleWebhook(req: Request) {
  const signature = req.headers.get("signature");
  const rawBody = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const reference = payload.data?.reference as string | undefined;
  const orderId = reference?.match(/^order-([0-9a-fA-F-]{36})-/)?.[1];
  if (!orderId) return json({ received: true }); // not a reference we generated — ignore

  const { data: order } = await admin.from("orders").select("id, tenant_id, customer_id").eq("id", orderId).maybeSingle();
  if (!order) return json({ received: true });

  const { data: settings } = await admin
    .from("fincra_settings")
    .select("webhook_secret")
    .eq("tenant_id", order.tenant_id)
    .maybeSingle();
  if (!settings) return json({ received: true });

  const expectedSignature = await hmacSha512Hex(settings.webhook_secret, rawBody);
  if (!safeEqual(expectedSignature, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  if (payload.event === "charge.successful" && payload.data?.status === "success") {
    const externalReference = (payload.data.chargeReference as string | undefined) ?? reference!;

    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("external_reference", externalReference)
      .maybeSingle();
    if (!existing) {
      const amount = Number(payload.data.amount ?? 0);
      await admin.from("payments").insert({
        tenant_id: order.tenant_id,
        customer_id: order.customer_id,
        order_id: order.id,
        amount,
        method: "fincra",
        external_reference: externalReference,
        charged_currency: (payload.data.currency as string | undefined) ?? null,
        charged_amount: amount,
        paid_at: new Date().toISOString(),
      });
    }
  }

  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith("/initiate")) return await handleInitiate(req);
    if (path.endsWith("/webhook")) return await handleWebhook(req);
    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
