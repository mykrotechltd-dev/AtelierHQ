// RCS via Infobip. Confirmed against Infobip's live API docs (same
// re-verify-before-going-live caveat as sms.ts/whatsapp.ts):
//   Capability check: POST {INFOBIP_BASE_URL}/rcs/2/capability-check/query
//     Body: { sender, phoneNumbers: [...] }
//     Response: { capabilityCheckResults: [{ phoneNumber, code }] },
//     code is "ENABLED" when the destination can receive RCS.
//   Send:            POST {INFOBIP_BASE_URL}/ott/rcs/1/message
//     Body: { from, to, content: { type: "TEXT", text }, messageId }
//     Response: { messages: [{ messageId, status: {...} }] }
//
// This sends a plain-text RCS message, not a rich card — Infobip's docs
// describe a template/card variant for RCS too, but the exact
// request/response shape for that endpoint wasn't confirmable from the
// public docs at the time this was written (see the architecture review,
// §4: RCS agent verification + card template review is a real prerequisite
// this app hasn't gone through yet). Plain text still exercises the real
// channel and the real capability check; upgrading to rich cards is a
// follow-up once this app is further into Infobip's RCS onboarding.
import type { ChannelAdapter } from "./types.ts";
import { toMsisdn } from "./phone.ts";
import { renderTemplateText } from "./templates.ts";

const INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL") ?? "";
const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY") ?? "";
// The registered RCS agent id (Infobip's "sender" for RCS).
const INFOBIP_RCS_SENDER = Deno.env.get("INFOBIP_RCS_SENDER") ?? "";

export const RCSAdapter: ChannelAdapter = {
  channel: "rcs",
  async supports(recipient) {
    if (!INFOBIP_BASE_URL || !INFOBIP_API_KEY || !INFOBIP_RCS_SENDER) return false;
    try {
      const res = await fetch(`${INFOBIP_BASE_URL}/rcs/2/capability-check/query`, {
        method: "POST",
        headers: {
          Authorization: `App ${INFOBIP_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: INFOBIP_RCS_SENDER,
          phoneNumbers: [toMsisdn(recipient.phoneE164)],
        }),
      });
      if (!res.ok) return false;
      const body = await res.json().catch(() => null);
      return body?.capabilityCheckResults?.[0]?.code === "ENABLED";
    } catch {
      // A capability-check failure means "don't know," not "yes" — never
      // send on a channel we couldn't confirm the destination supports;
      // fall through to the next channel instead.
      return false;
    }
  },
  async send(recipient, content) {
    const res = await fetch(`${INFOBIP_BASE_URL}/ott/rcs/1/message`, {
      method: "POST",
      headers: {
        Authorization: `App ${INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: INFOBIP_RCS_SENDER,
        to: toMsisdn(recipient.phoneE164),
        content: { type: "TEXT", text: renderTemplateText(content) },
      }),
    });

    const body = await res.json().catch(() => null);
    const message = body?.messages?.[0];

    if (res.ok && message?.messageId) {
      return { channel: "rcs", providerMessageId: message.messageId, status: "accepted" };
    }
    return {
      channel: "rcs",
      providerMessageId: message?.messageId ?? "",
      status: "failed",
      errorCode: body?.requestError?.serviceException?.messageId,
      errorMessage: body?.requestError?.serviceException?.text ?? "RCS send failed",
    };
  },
};
