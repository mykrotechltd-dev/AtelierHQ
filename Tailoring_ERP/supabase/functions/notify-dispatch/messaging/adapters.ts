// Aggregates the three real, Infobip-backed channel adapters. Each
// adapter's own file (whatsapp.ts, rcs.ts, sms.ts) owns everything specific
// to that channel — its endpoint, payload shape, and eligibility rule; this
// file only wires them into the shape ProviderMessagingService expects.
import { WhatsAppAdapter } from "./whatsapp.ts";
import { RCSAdapter } from "./rcs.ts";
import { SMSAdapter } from "./sms.ts";
import type { ChannelAdapter, MessageChannel } from "./types.ts";

export { WhatsAppAdapter, RCSAdapter, SMSAdapter };

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
