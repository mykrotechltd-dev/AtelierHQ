// Placeholder channel adapters.
//
// This wires the full outbox -> dispatch -> MessagingService.sendWithFallback
// path end-to-end and exercises it for real, but does NOT talk to a real
// provider yet — that's a deliberately separate next step (replace this
// file's three adapters with real Infobip WhatsApp/RCS/SMS calls reading
// INFOBIP_API_KEY / INFOBIP_BASE_URL from Deno.env, plus the RCS live
// capability lookup for RCSAdapter.supports()).
//
// Every adapter here reports supports() = true, so sendWithFallback genuinely
// walks the whole ["whatsapp", "rcs", "sms"] chain, and send() returns an
// honest status:"failed" result rather than pretending a message went out —
// this system must never record "sent" for a message nothing actually
// delivered.
import type { ChannelAdapter, MessageChannel } from "./types.ts";

function notImplemented(channel: MessageChannel): ChannelAdapter {
  return {
    channel,
    async supports() {
      return true;
    },
    async send(recipient) {
      return {
        channel,
        providerMessageId: "",
        status: "failed",
        errorCode: "not_implemented",
        errorMessage:
          `${channel} adapter is not yet wired to a provider ` +
          `(recipient ${recipient.phoneE164}) — see integration plan step 6.`,
      };
    },
  };
}

export const WhatsAppAdapter = notImplemented("whatsapp");
export const RCSAdapter = notImplemented("rcs");
export const SMSAdapter = notImplemented("sms");

export const adapters: Record<MessageChannel, ChannelAdapter> = {
  whatsapp: WhatsAppAdapter,
  rcs: RCSAdapter,
  sms: SMSAdapter,
};

/** WhatsApp first (richest, but opt-in gated), then RCS (rich, capability
 *  gated), always falling back to SMS (the guaranteed-delivery floor). */
export const DEFAULT_CHANNEL_ORDER: readonly MessageChannel[] = [
  "whatsapp",
  "rcs",
  "sms",
];
