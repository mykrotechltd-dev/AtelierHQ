// Notification dispatcher for AtelierHQ. Drains supabase/migrations/0009's
// notification_outbox table: one row means "an order crossed a
// customer-facing status boundary and a message should go out for it."
//
// Routes:
//   POST /                — dispatch a newly-inserted outbox row. Any POST
//     to this function's bare base URL is treated as a dispatch event;
//     there is deliberately no path suffix to route on here. This project's
//     Database Webhook is delivered via a pg_net trigger instead of the
//     Dashboard's "Database Webhooks -> Supabase Edge Functions" feature
//     (see supabase/migrations/0010's header — that dashboard feature
//     failed with "schema supabase_functions does not exist" on this
//     project), but the same constraint that motivated the no-path-suffix
//     design still holds: the trigger calls this function's plain base URL.
//   POST /webhook          — Infobip's delivery-status callback, configured
//     against the FULL url .../notify-dispatch/webhook in Infobip's
//     Subscriptions setup (unlike the Supabase Dashboard, Infobip's webhook
//     config does let you specify an arbitrary path, so this route can use
//     one safely).
//
// Modeled directly on supabase/functions/fincra-checkout/index.ts's shape:
// service-role admin client, Deno.serve, a json() helper, HMAC webhook
// verification (via ../_shared/hmac.ts, extracted now that this is the
// third caller). The one deliberate difference beyond that is *why* the
// dispatch route is called at all — fincra-checkout's /initiate route is
// invoked by a browser (needs getCallerTenant() to authenticate a user's
// bearer token); this function's dispatch route is invoked only by
// Postgres's own trigger, so there's no caller identity to authenticate —
// the content to trust is the outbox row itself, plus a defensive re-read
// of the order/customer/tenant join rather than trusting the row's payload
// values wholesale (see hydrateContext below).
//
// The channel adapters (./messaging/{whatsapp,rcs,sms}.ts) call Infobip for
// real. Required edge function secrets (set with
// `npx supabase secrets set NAME=value`, never committed — see
// .env.local.example's handling of SUPABASE_SERVICE_ROLE_KEY for the same
// convention):
//   INFOBIP_API_KEY            — Infobip API key (Authorization: App header)
//   INFOBIP_BASE_URL            — e.g. https://xxxxx.api.infobip.com
//   INFOBIP_SMS_SENDER          — alphanumeric SMS sender id
//   INFOBIP_WHATSAPP_SENDER     — the verified WhatsApp Business number
//   INFOBIP_RCS_SENDER          — the verified RCS agent id
//   INFOBIP_WEBHOOK_SIGNING_KEY — verifies the X-Hub-Signature header on
//                                 Infobip's delivery-status callbacks
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-provided to every
// edge function already.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ProviderMessagingService } from "./messaging/service.ts";
import { adapters, DEFAULT_CHANNEL_ORDER } from "./messaging/adapters.ts";
import type {
  MessageChannel,
  MessageContent,
  MessageRecipient,
} from "./messaging/types.ts";
import { hmacSha256Hex, safeEqual } from "../_shared/hmac.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFOBIP_WEBHOOK_SIGNING_KEY = Deno.env.get("INFOBIP_WEBHOOK_SIGNING_KEY") ?? "";

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
  channel_used: string | null;
  provider_message_id: string | null;
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

type HydratedContext = NonNullable<Awaited<ReturnType<typeof hydrateContext>>>;

/** Shared by the initial dispatch and the delivery-webhook's re-fallback —
 *  both need the same MessageRecipient/MessageContent built from the same
 *  hydrated context, so this is the one place that shape gets assembled. */
function buildRecipientAndContent(
  row: OutboxRow,
  context: HydratedContext,
): { recipient: MessageRecipient; content: MessageContent } {
  return {
    recipient: {
      phoneE164: context.customerPhone!,
      whatsappOptedIn: context.whatsappOptedIn,
    },
    content: {
      templateKey: row.template_key as MessageContent["templateKey"],
      params: {
        order_number: context.orderNumber,
        customer_name: context.customerName,
        shop_name: context.shopName,
        total_amount: context.totalAmount.toFixed(2),
        currency: context.currency,
      },
      // mediaUrl (a hosted invoice link) is intentionally omitted here — it
      // needs a signed, tenant-scoped viewer route that doesn't exist in
      // this app yet (see the messaging architecture review, §4). Adding
      // one is a separate, later step; MessageContent already threads
      // mediaUrl through so no further plumbing will be needed then.
    },
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

  const { recipient, content } = buildRecipientAndContent(row, context);

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

// Infobip's delivery-report shape (see messaging/sms.ts's header comment for
// the confirmed-vs-assumed caveat — corroborated for SMS specifically;
// WhatsApp/RCS delivery reports are assumed to share this envelope until a
// live callback confirms it, so this reads leniently rather than asserting
// one exact shape).
interface InfobipDeliveryResult {
  messageId?: string;
  status?: { groupName?: string; name?: string; description?: string };
  error?: { name?: string; description?: string };
}
interface InfobipDeliveryPayload {
  results?: InfobipDeliveryResult[];
}

/** A channel that reported success at send time can still fail delivery
 *  later — this is where that later failure re-enters the fallback chain,
 *  picking up on whichever channels weren't already tried. */
async function reFallbackAfterFailure(row: OutboxRow, failedChannel: string) {
  const order = DEFAULT_CHANNEL_ORDER;
  const failedIndex = order.indexOf(failedChannel as MessageChannel);
  const remaining = failedIndex === -1 ? [] : order.slice(failedIndex + 1);

  if (remaining.length === 0) {
    await markOutbox(row.id, {
      status: "failed",
      last_error: `${failedChannel} reported failure after initial acceptance, no channels left to try`,
    });
    return;
  }

  const context = await hydrateContext(row);
  if (!context?.customerPhone) {
    await markOutbox(row.id, {
      status: "failed",
      last_error: "Could not re-verify order/customer/tenant for re-fallback",
    });
    return;
  }

  const { recipient, content } = buildRecipientAndContent(row, context);
  try {
    const result = await messagingService.sendWithFallback(recipient, content, remaining);
    await markOutbox(row.id, {
      status: result.status === "accepted" ? "sent" : "failed",
      channel_used: result.channel,
      provider_message_id: result.providerMessageId || undefined,
      last_error: result.errorMessage,
      params: content.params,
    });
  } catch (err) {
    await markOutbox(row.id, {
      status: "failed",
      last_error: err instanceof Error ? err.message : "Unknown re-fallback error",
      params: content.params,
    });
  }
}

async function handleDeliveryWebhook(req: Request) {
  const signature = req.headers.get("X-Hub-Signature");
  const rawBody = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });
  if (!INFOBIP_WEBHOOK_SIGNING_KEY) {
    console.error("INFOBIP_WEBHOOK_SIGNING_KEY is not set — refusing webhook");
    return new Response("Not configured", { status: 500 });
  }

  const expectedSignature = await hmacSha256Hex(INFOBIP_WEBHOOK_SIGNING_KEY, rawBody);
  if (!safeEqual(expectedSignature, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: InfobipDeliveryPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  for (const result of payload.results ?? []) {
    if (!result.messageId) continue;

    const { data: row } = await admin
      .from("notification_outbox")
      .select("*")
      .eq("provider_message_id", result.messageId)
      .maybeSingle();
    // Not a message id this system generated, or superseded by a later
    // re-fallback that already overwrote provider_message_id — a benign
    // no-op, same as fincra-checkout's "not a reference we generated" case.
    if (!row || row.status !== "sent") continue;

    const groupName = result.status?.groupName;
    if (!groupName || groupName === "PENDING" || groupName === "DELIVERED") {
      // Still in flight, or actually delivered — nothing to do. Delivery
      // confirmation doesn't need a state beyond 'sent' in this model.
      continue;
    }

    // Anything else (UNDELIVERABLE, REJECTED, EXPIRED, ...) is a real,
    // post-acceptance failure on the channel this row already committed to.
    await reFallbackAfterFailure(row as OutboxRow, row.channel_used as string);
  }

  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Not found" }, 404);
    const path = new URL(req.url).pathname;
    if (path.endsWith("/webhook")) return await handleDeliveryWebhook(req);
    return await handleDispatch(req);
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
