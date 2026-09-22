// Notification dispatcher for AtelierHQ. Drains supabase/migrations/0009's
// notification_outbox table: one row means "an order crossed a
// customer-facing status boundary and a message should go out for it."
//
// Route: any POST to this function's base URL is treated as a dispatch
// event — there is deliberately no path suffix to route on. The Dashboard's
// "Database Webhooks -> Supabase Edge Functions" trigger type (see 0009's
// "Manual setup" comment) only lets you pick a function by name; it always
// calls that function's bare URL, with no field to append a path segment
// to, so this function has to accept POSTs at its root rather than
// requiring e.g. /dispatch. If a second route is ever needed here, add path
// matching then — don't require a suffix the webhook UI can't produce.
//
// Modeled directly on supabase/functions/fincra-checkout/index.ts's shape:
// service-role admin client, Deno.serve, a json() helper — but routing on
// method (POST) rather than path suffix, per the note above. The one
// deliberate difference beyond that is *why* this function is called at
// all — fincra-checkout is invoked by a browser (needs getCallerTenant() to
// authenticate a user's bearer token) or by Fincra's own signed webhook;
// this function is invoked only by Supabase's own Database Webhook
// infrastructure, so there's no caller identity to authenticate — the
// content to trust is the outbox row itself, plus a defensive re-read of
// the order/customer/tenant join rather than trusting the row's payload
// values wholesale (see hydrateContext below).
//
// The channel adapters wired in here (./messaging/adapters.ts) are
// deliberate placeholders that record an honest "not yet implemented"
// failure rather than a real provider call — see that file's header. This
// function fully exercises the outbox -> dispatch -> fallback-chain ->
// outcome-recorded path end to end; only the actual Infobip calls are a
// separate next step.
//
// Required edge function secrets: none beyond what every function already
// gets — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-provided. The
// real adapters will need INFOBIP_API_KEY / INFOBIP_BASE_URL, read via
// Deno.env.get(...) only, exactly like every other secret in this project
// (see fincra-checkout/index.ts) — never inlined here or anywhere else.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ProviderMessagingService } from "./messaging/service.ts";
import { adapters, DEFAULT_CHANNEL_ORDER } from "./messaging/adapters.ts";
import type { MessageContent, MessageRecipient } from "./messaging/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const messagingService = new ProviderMessagingService(adapters);

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

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
}

interface OutboxRow {
  id: number;
  tenant_id: string;
  order_id: string;
  customer_id: string;
  to_status: string;
  template_key: string;
  status: string;
  attempt_count: number;
}

/** Re-reads the order/customer/tenant join fresh from the database, scoped
 *  by the outbox row's own order_id — never trusts the webhook payload's
 *  tenant_id/customer_id on its own, the same "the row's own foreign keys
 *  are the trust boundary, not the caller's claims" rule the SQL trigger in
 *  0009 already follows. Returns null if anything doesn't line up. */
async function hydrateContext(row: OutboxRow) {
  const { data: order, error } = await admin
    .from("orders")
    .select("order_number, total_amount, tenant_id, customer_id, customers(name, phone, whatsapp_opt_in), tenants(name, notify_sender_name, currency)")
    .eq("id", row.order_id)
    .maybeSingle();
  if (error || !order) return null;

  // Defense in depth: the outbox row and the order it references must agree
  // on which tenant/customer this is. A mismatch here is either a bug or
  // something worth refusing to send for, never something to guess past.
  if (order.tenant_id !== row.tenant_id || order.customer_id !== row.customer_id) {
    return null;
  }

  const customer = order.customers as unknown as {
    name: string;
    phone: string | null;
    whatsapp_opt_in: boolean;
  } | null;
  const tenant = order.tenants as unknown as {
    name: string;
    notify_sender_name: string | null;
    currency: string;
  } | null;
  // A missing customer/tenant row here means the FK join itself broke
  // (deleted mid-flight) — that's the same "can't trust this row" case as
  // the mismatch above, not "no phone." A missing *phone* is a normal,
  // expected outcome (handled separately below, not folded in here) so the
  // caller can record it as 'skipped' rather than 'failed'.
  if (!customer || !tenant) return null;

  return {
    orderNumber: order.order_number as string,
    totalAmount: Number(order.total_amount),
    customerName: customer.name,
    customerPhone: customer.phone,
    whatsappOptedIn: customer.whatsapp_opt_in,
    shopName: tenant.notify_sender_name ?? tenant.name,
    currency: tenant.currency,
  };
}

async function markOutbox(
  id: number,
  patch: {
    status: "sent" | "failed" | "skipped";
    channel_used?: string;
    provider_message_id?: string;
    last_error?: string;
    params?: Record<string, string>;
  },
) {
  await admin
    .from("notification_outbox")
    .update({
      ...patch,
      sent_at: patch.status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id);
}

async function handleDispatch(req: Request) {
  const payload = (await req.json().catch(() => null)) as DatabaseWebhookPayload | null;
  if (!payload || payload.table !== "notification_outbox" || payload.type !== "INSERT") {
    // Not an event this function cares about — acknowledge, don't retry.
    return json({ received: true });
  }

  const row = payload.record as unknown as OutboxRow | null;
  if (!row?.id) return json({ received: true });

  // A redelivered webhook for a row this function already finished is a
  // no-op, not an error — the outbox row itself is the source of truth for
  // "did this already go out," not the webhook delivery.
  if (row.status !== "pending") {
    return json({ received: true, skipped: "not pending" });
  }

  const context = await hydrateContext(row);
  if (!context) {
    await markOutbox(row.id, {
      status: "failed",
      last_error: "Could not re-verify order/customer/tenant for this outbox row",
    });
    return json({ received: true });
  }

  // No phone should already have been caught by the trigger (0009) and
  // recorded as 'skipped' before this row ever existed — this is a second,
  // defensive check, not the primary guard.
  if (!context.customerPhone) {
    await markOutbox(row.id, { status: "skipped", last_error: "no phone on file" });
    return json({ received: true });
  }

  const recipient: MessageRecipient = {
    phoneE164: context.customerPhone,
    whatsappOptedIn: context.whatsappOptedIn,
  };
  const content: MessageContent = {
    templateKey: row.template_key as MessageContent["templateKey"],
    params: {
      order_number: context.orderNumber,
      customer_name: context.customerName,
      shop_name: context.shopName,
      total_amount: context.totalAmount.toFixed(2),
      currency: context.currency,
    },
    // mediaUrl (a hosted invoice link) is intentionally omitted here — it
    // needs a signed, tenant-scoped viewer route that doesn't exist in this
    // app yet (see the messaging architecture review, §4). Adding one is a
    // separate, later step; this dispatcher already threads mediaUrl
    // through MessageContent so no further plumbing will be needed then.
  };

  // Record the attempt before calling out, so a crash mid-send still shows
  // up as "we tried" (attempt_count > 0, still pending) rather than looking
  // untouched.
  await admin
    .from("notification_outbox")
    .update({ attempt_count: row.attempt_count + 1 })
    .eq("id", row.id);

  try {
    const result = await messagingService.sendWithFallback(
      recipient,
      content,
      DEFAULT_CHANNEL_ORDER,
    );
    await markOutbox(row.id, {
      status: result.status === "accepted" ? "sent" : "failed",
      channel_used: result.channel,
      provider_message_id: result.providerMessageId || undefined,
      last_error: result.errorMessage,
      params: content.params,
    });
  } catch (err) {
    // An adapter threw (a bug, not a normal per-channel rejection) — record
    // it plainly rather than letting it vanish into a 500 with no trace.
    await markOutbox(row.id, {
      status: "failed",
      last_error: err instanceof Error ? err.message : "Unknown dispatch error",
      params: content.params,
    });
  }

  // Always 2xx once an outcome (sent/failed/skipped) is durably recorded on
  // the row — that row is the record of what happened, so there's nothing
  // for Supabase's webhook retry to usefully redo. Only a failure to reach
  // this point at all (caught in the Deno.serve wrapper below) should be
  // retried.
  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "POST") return await handleDispatch(req);
    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
