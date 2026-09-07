// Stripe Connect for AtelierHQ (Tailoring_Shop_ERP).
//
// One platform Stripe account (this shop's own Stripe account, with Connect
// enabled) manages one Express connected account per tenant. Charges are
// created directly on the tenant's connected account (Direct charges, no
// application fee) — money never passes through the platform's balance.
// The platform's Stripe secret key lives ONLY here, as an edge function
// secret — it is never stored in Postgres and never reaches the browser.
//
// Routes (matched on the path after the function name):
//   POST /stripe-connect/create-account-link   — start/resume onboarding
//   POST /stripe-connect/account-status         — re-sync status from Stripe
//   POST /stripe-connect/create-checkout-session — direct-charge Checkout
//   POST /stripe-connect/webhook                 — Stripe → this function
//
// Required edge function secrets (`supabase secrets set ...`):
//   STRIPE_SECRET_KEY      — the platform's own Stripe secret key
//   STRIPE_WEBHOOK_SECRET  — signing secret for the webhook endpoint below
//   APP_URL                — e.g. https://your-app.vercel.app (onboarding
//                             return/refresh URLs and Checkout success/cancel)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every edge function — no need to set them.
//
// Manual setup in the Stripe Dashboard (this code can't do this part):
//   1. Enable Connect on the platform account (Settings → Connect).
//   2. Register this function's /webhook URL as a *Connect* webhook
//      endpoint (Developers → Webhooks → "Listen to events on Connected
//      accounts") subscribed to checkout.session.completed and
//      account.updated — a regular (non-Connect) endpoint will not
//      receive events for the tenants' connected accounts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
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
    .select("tenant_id, role")
    .eq("id", userData.user.id)
    .single();
  if (!profile) return null;

  const { data: tenant } = await admin.from("tenants").select("*").eq("id", profile.tenant_id).single();
  if (!tenant) return null;

  return { tenant, role: profile.role as string };
}

function statusFromAccount(account: Stripe.Account): "active" | "pending" | "restricted" {
  if (account.charges_enabled && account.payouts_enabled) return "active";
  if (account.requirements?.disabled_reason) return "restricted";
  return "pending";
}

async function handleCreateAccountLink(req: Request) {
  const caller = await getCallerTenant(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  if (caller.role !== "owner") return json({ error: "Only the shop owner can connect Stripe" }, 403);

  let accountId = caller.tenant.stripe_connect_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express" });
    accountId = account.id;
    await admin
      .from("tenants")
      .update({ stripe_connect_account_id: accountId, stripe_onboarding_status: "pending" })
      .eq("id", caller.tenant.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/settings?stripe=refresh`,
    return_url: `${APP_URL}/settings?stripe=return`,
    type: "account_onboarding",
  });

  return json({ url: link.url });
}

async function handleAccountStatus(req: Request) {
  const caller = await getCallerTenant(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const accountId = caller.tenant.stripe_connect_account_id as string | null;
  if (!accountId) return json({ status: "not_started" });

  const account = await stripe.accounts.retrieve(accountId);
  const status = statusFromAccount(account);

  await admin
    .from("tenants")
    .update({
      stripe_onboarding_status: status,
      stripe_country: account.country ?? null,
      stripe_default_currency: account.default_currency ?? null,
    })
    .eq("id", caller.tenant.id);

  return json({ status, country: account.country, currency: account.default_currency });
}

async function handleCreateCheckoutSession(req: Request) {
  const caller = await getCallerTenant(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const accountId = caller.tenant.stripe_connect_account_id as string | null;
  if (!accountId || caller.tenant.stripe_onboarding_status !== "active") {
    return json({ error: "Stripe is not connected for this shop" }, 400);
  }

  const { orderId, amount } = (await req.json()) as { orderId: string; amount: number };
  if (!orderId || !(amount > 0)) return json({ error: "Invalid order or amount" }, 400);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", caller.tenant.id)
    .single();
  if (orderError || !order) return json({ error: "Order not found" }, 404);

  const { data: payments } = await admin.from("payments").select("amount").eq("order_id", orderId);
  const alreadyPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = Number(order.total_amount) - alreadyPaid;
  if (amount > outstanding) {
    return json({ error: `Amount would exceed the order total. Outstanding: ${outstanding}.` }, 400);
  }

  const currency = (caller.tenant.stripe_default_currency ?? caller.tenant.currency ?? "usd").toLowerCase();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Order ${order.order_number}` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/orders/${orderId}?stripe=success`,
      cancel_url: `${APP_URL}/orders/${orderId}?stripe=cancelled`,
      metadata: { orderId, tenantId: caller.tenant.id },
    },
    { stripeAccount: accountId }
  );

  return json({ url: session.url });
}

async function handleWebhook(req: Request) {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const tenantId = session.metadata?.tenantId;
    if (orderId && tenantId) {
      const { data: order } = await admin.from("orders").select("customer_id").eq("id", orderId).single();
      if (order) {
        await admin.from("payments").insert({
          tenant_id: tenantId,
          customer_id: order.customer_id,
          order_id: orderId,
          amount: (session.amount_total ?? 0) / 100,
          method: "stripe",
          external_reference: session.id,
          charged_currency: session.currency,
          charged_amount: (session.amount_total ?? 0) / 100,
          paid_at: new Date().toISOString(),
        });
      }
    }
  } else if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const status = statusFromAccount(account);
    await admin
      .from("tenants")
      .update({
        stripe_onboarding_status: status,
        stripe_country: account.country ?? null,
        stripe_default_currency: account.default_currency ?? null,
      })
      .eq("stripe_connect_account_id", account.id);
  }

  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith("/create-account-link")) return await handleCreateAccountLink(req);
    if (path.endsWith("/account-status")) return await handleAccountStatus(req);
    if (path.endsWith("/create-checkout-session")) return await handleCreateCheckoutSession(req);
    if (path.endsWith("/webhook")) return await handleWebhook(req);
    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
