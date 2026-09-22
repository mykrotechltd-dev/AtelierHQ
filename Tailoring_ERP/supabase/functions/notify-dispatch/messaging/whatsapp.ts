// WhatsApp via Infobip. Confirmed against Infobip's live API docs (same
// re-verify-before-going-live caveat as sms.ts — no sandbox account to test
// an actual send against):
//   POST {INFOBIP_BASE_URL}/whatsapp/1/message/template
//   Headers: Authorization: App {INFOBIP_API_KEY}
//   Body: { messages: [{ from, to, messageId, content: { templateName,
//           templateData: { body: { placeholders: [...] } }, language } }] }
//   Response: { messages: [{ messageId, status: {...} }] }
//
// Meta requires a pre-approved, provider-hosted template for ANY
// business-initiated WhatsApp message outside a 24h customer-service
// session — an order-status ping is always outside that window, so this
// adapter can never send free text, only a named template with an ordered
// placeholder array. TEMPLATE_NAMES/PLACEHOLDER_ORDER below must match
// exactly what Meta actually approved (see NOTES.md next to
// supabase/migrations/0009_notifications.sql for the approved names and
// placeholder order — update both together, never independently, or a
// send will be rejected or silently place the wrong value in the wrong
// slot).
import type { ChannelAdapter, MessageContent } from "./types.ts";
import { toMsisdn } from "./phone.ts";

const INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL") ?? "";
const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY") ?? "";
// The registered WhatsApp Business sender number (see §5 of the
// architecture review: one shared, platform-verified sender for every
// tenant — per-tenant branding lives in the message text via shop_name,
// not the sender identity).
const INFOBIP_WHATSAPP_SENDER = Deno.env.get("INFOBIP_WHATSAPP_SENDER") ?? "";

const TEMPLATE_NAMES: Record<MessageContent["templateKey"], string> = {
  order_completed: "order_completed",
  order_delivered: "order_delivered",
};

// Meta templates take an ORDERED placeholder array, not named fields — this
// is what maps this function's named params onto that array, in the exact
// order the approved template body uses them.
const PLACEHOLDER_ORDER: Record<MessageContent["templateKey"], string[]> = {
  order_completed: ["customer_name", "shop_name", "order_number"],
  order_delivered: ["customer_name", "shop_name", "order_number"],
};

export const WhatsAppAdapter: ChannelAdapter = {
  channel: "whatsapp",
  async supports(recipient) {
    // Meta requires documented, affirmative opt-in before a business can
    // message a customer on WhatsApp at all — a phone number on file is
    // not itself consent (customers.whatsapp_opt_in captures this
    // explicitly at customer intake).
    return recipient.whatsappOptedIn && !!INFOBIP_WHATSAPP_SENDER;
  },
  async send(recipient, content) {
    if (!INFOBIP_BASE_URL || !INFOBIP_API_KEY || !INFOBIP_WHATSAPP_SENDER) {
      return {
        channel: "whatsapp",
        providerMessageId: "",
        status: "failed",
        errorCode: "not_configured",
        errorMessage: "INFOBIP_BASE_URL/INFOBIP_API_KEY/INFOBIP_WHATSAPP_SENDER are not set",
      };
    }

    const placeholders = PLACEHOLDER_ORDER[content.templateKey].map(
      (key) => content.params[key] ?? "",
    );

    const res = await fetch(`${INFOBIP_BASE_URL}/whatsapp/1/message/template`, {
      method: "POST",
      headers: {
        Authorization: `App ${INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: INFOBIP_WHATSAPP_SENDER,
            to: toMsisdn(recipient.phoneE164),
            messageId: crypto.randomUUID(),
            content: {
              templateName: TEMPLATE_NAMES[content.templateKey],
              templateData: { body: { placeholders } },
              language: "en",
            },
          },
        ],
      }),
    });

    const body = await res.json().catch(() => null);
    const message = body?.messages?.[0];

    if (res.ok && message?.messageId) {
      return { channel: "whatsapp", providerMessageId: message.messageId, status: "accepted" };
    }
    return {
      channel: "whatsapp",
      providerMessageId: message?.messageId ?? "",
      status: "failed",
      errorCode: body?.requestError?.serviceException?.messageId,
      errorMessage: body?.requestError?.serviceException?.text ?? "WhatsApp template send failed",
    };
  },
};
