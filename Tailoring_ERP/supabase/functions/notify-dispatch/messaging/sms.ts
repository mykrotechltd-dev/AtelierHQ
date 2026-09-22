// SMS via Infobip. Confirmed against Infobip's live API docs (corroborated
// across their own reference pages and SDK examples — no sandbox account
// was available to test an actual send, so re-verify against a real
// response if anything here stops matching reality, same caveat
// fincra-checkout/index.ts states for Fincra's own thinner docs):
//   POST {INFOBIP_BASE_URL}/sms/2/text/advanced
//   Headers: Authorization: App {INFOBIP_API_KEY}
//   Body: { messages: [{ from, destinations: [{ to }], text }] }
//   Response: { messages: [{ messageId, status: { groupName, name, description } }] }
//   status.groupName is "PENDING" on initial acceptance (not yet delivered
//   — that confirmation arrives later via the delivery-status webhook,
//   handled in notify-dispatch/index.ts's /webhook route) or "REJECTED"
//   for an immediate failure (e.g. invalid number).
import type { ChannelAdapter } from "./types.ts";
import { toMsisdn } from "./phone.ts";
import { renderTemplateText } from "./templates.ts";

const INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL") ?? "";
const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY") ?? "";
// Alphanumeric sender id. Infobip requires this be pre-registered per
// country in many regions — falls back to a plain default so a missing
// env var fails loudly at Infobip (a clear provider error) rather than
// silently as an empty "from".
const INFOBIP_SMS_SENDER = Deno.env.get("INFOBIP_SMS_SENDER") || "AtelierHQ";

export const SMSAdapter: ChannelAdapter = {
  channel: "sms",
  async supports() {
    // The guaranteed-delivery floor — every E.164 number qualifies. The
    // fallback chain only reaches here after WhatsApp/RCS have already
    // been ruled out or have failed.
    return true;
  },
  async send(recipient, content) {
    if (!INFOBIP_BASE_URL || !INFOBIP_API_KEY) {
      return {
        channel: "sms",
        providerMessageId: "",
        status: "failed",
        errorCode: "not_configured",
        errorMessage: "INFOBIP_BASE_URL/INFOBIP_API_KEY are not set",
      };
    }

    const res = await fetch(`${INFOBIP_BASE_URL}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: INFOBIP_SMS_SENDER,
            destinations: [{ to: toMsisdn(recipient.phoneE164) }],
            text: renderTemplateText(content),
          },
        ],
      }),
    });

    const body = await res.json().catch(() => null);
    const message = body?.messages?.[0];
    const groupName = message?.status?.groupName as string | undefined;

    if (res.ok && message?.messageId && groupName !== "REJECTED") {
      return { channel: "sms", providerMessageId: message.messageId, status: "accepted" };
    }
    return {
      channel: "sms",
      providerMessageId: message?.messageId ?? "",
      status: "failed",
      errorCode: message?.status?.name ?? body?.requestError?.serviceException?.messageId,
      errorMessage:
        message?.status?.description ??
        body?.requestError?.serviceException?.text ??
        "SMS send failed",
    };
  },
};
