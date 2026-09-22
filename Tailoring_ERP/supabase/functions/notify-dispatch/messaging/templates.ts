import type { MessageContent } from "./types.ts";

// Plain-text renderings for SMS and RCS. Unlike WhatsApp — where Meta
// requires a pre-approved, provider-hosted template for any business
// message outside a 24h session window — SMS and RCS have no such
// requirement here: Infobip sends whatever text this function gives it.
// (RCS *can* carry richer, provider-hosted card templates too, once this
// app is far enough into Infobip's RCS onboarding to register one — see
// rcs.ts's header comment. Plain text is what's confirmed working today.)
//
// Kept independent from whatsapp.ts's TEMPLATE_NAMES/PLACEHOLDER_ORDER:
// those describe a template Meta approved by name; these are just strings
// this codebase owns outright and can change freely.
const TEMPLATES: Record<
  MessageContent["templateKey"],
  (p: Record<string, string>) => string
> = {
  order_completed: (p) =>
    `${p.shop_name}: Hi ${p.customer_name}, your order ${p.order_number} is ` +
    `complete and ready for pickup/delivery. Total: ${p.currency} ${p.total_amount}.`,
  order_delivered: (p) =>
    `${p.shop_name}: Hi ${p.customer_name}, your order ${p.order_number} has ` +
    `been delivered. Thank you for choosing us!`,
};

export function renderTemplateText(content: MessageContent): string {
  return TEMPLATES[content.templateKey](content.params);
}
