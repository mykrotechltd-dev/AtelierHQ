// Provider-agnostic messaging contract. Nothing outside this module — not
// index.ts, not the SQL trigger that enqueues an outbox row — knows which
// HTTP API, auth scheme, or payload shape a channel actually uses. That
// knowledge lives entirely in the adapters (messaging/adapters.ts), so
// swapping providers later touches adapters only, never business logic.

export type MessageChannel = "whatsapp" | "rcs" | "sms";

export interface MessageRecipient {
  /** E.164 only, e.g. +2348012345678 — never a raw local-format number. */
  phoneE164: string;
  /** Meta requires documented, affirmative opt-in before a business can
   *  message a customer on WhatsApp at all — a phone number on file is not
   *  itself consent. Backed by customers.whatsapp_opt_in. */
  whatsappOptedIn: boolean;
}

export interface MessageContent {
  /** A pre-approved template name (Meta/RCS templates only — never free
   *  text on WhatsApp/RCS outside a 24h customer-service session, which an
   *  order-status ping is always outside of). */
  templateKey: "order_completed" | "order_delivered";
  /** Named placeholders the approved template fills in. */
  params: Record<string, string>;
  /** A link to a hosted, viewable invoice — never a binary attachment
   *  (jsPDF only runs in the browser; nothing in this Deno function
   *  generates a PDF). */
  mediaUrl?: string;
}

export interface SendResult {
  channel: MessageChannel;
  providerMessageId: string;
  status: "accepted" | "failed";
  errorCode?: string;
  errorMessage?: string;
}

/** One adapter per channel. */
export interface ChannelAdapter {
  readonly channel: MessageChannel;
  /** Cheap, adapter-owned eligibility check — e.g. WhatsAppAdapter checks
   *  recipient.whatsappOptedIn; RCSAdapter does a live capability lookup
   *  against the provider (RCS support is carrier/device-dependent). */
  supports(recipient: MessageRecipient): Promise<boolean>;
  send(recipient: MessageRecipient, content: MessageContent): Promise<SendResult>;
}

/** The one thing status-change dispatch code is allowed to call. */
export interface MessagingService {
  sendWithFallback(
    recipient: MessageRecipient,
    content: MessageContent,
    order: readonly MessageChannel[],
  ): Promise<SendResult>;
}
