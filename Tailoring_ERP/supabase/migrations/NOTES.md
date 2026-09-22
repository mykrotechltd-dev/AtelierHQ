# Notifications (0009-0011): operational notes

Everything here is manual/external — nothing a migration or a code change
can do — but it directly constrains what the code in
`supabase/functions/notify-dispatch/` is allowed to assume. Keep this file
and `messaging/whatsapp.ts`'s `TEMPLATE_NAMES`/`PLACEHOLDER_ORDER` in sync;
update them together, never independently, or a send will be rejected by
Meta or silently place the wrong value in the wrong slot.

## WhatsApp template registration (Meta, via Infobip)

Required before the trigger goes live for any tenant: Meta requires a
pre-approved, provider-hosted template for any business-initiated WhatsApp
message outside a 24h customer-service session — an order-status ping is
always outside that window, so this is not optional.

Submit through Infobip's WhatsApp template flow
(https://www.infobip.com/docs/tutorials/send-whatsapp-template-messages):

| templateKey | Infobip/Meta template name | Placeholder order (body) | Status |
|---|---|---|---|
| `order_completed` | `order_completed` | 1. customer_name 2. shop_name 3. order_number | **not yet submitted** |
| `order_delivered` | `order_delivered` | 1. customer_name 2. shop_name 3. order_number | **not yet submitted** |

The name and placeholder order above are what `messaging/whatsapp.ts`
currently sends — they are this codebase's *proposal* for what to submit,
not a confirmation that Meta has approved them. Once Meta approves (or
requires different wording/order), update:
1. This table's "Status" column and the approved name if it changed.
2. `TEMPLATE_NAMES`/`PLACEHOLDER_ORDER` in `messaging/whatsapp.ts` to match
   exactly.

Suggested template body text to submit (placeholders numbered to match the
order above):

- `order_completed`: "Hi {{1}}, your order at {{2}} is complete and ready.
  Order #{{3}}."
- `order_delivered`: "Hi {{1}}, your order #{{3}} from {{2}} has been
  delivered. Thank you for choosing us!"

## RCS agent verification + card templates (Infobip)

Required before RCS delivers anything richer than plain text: agent
verification and, later, card/template review through Infobip's RCS
onboarding (https://www.infobip.com/docs/rcs/get-started). Not yet started.
`messaging/rcs.ts` sends plain text today (a real, working RCS message —
just not a rich card), which needs no template approval; upgrading it is a
separate follow-up once onboarding is further along.

## Required Infobip credentials (edge function secrets)

Set with `npx supabase secrets set NAME=value` — never committed, matching
this project's existing convention (see `.env.local.example`'s handling of
`SUPABASE_SERVICE_ROLE_KEY`):

| Secret | Purpose | Status |
|---|---|---|
| `INFOBIP_API_KEY` | Authorization header for every Infobip call | not yet set |
| `INFOBIP_BASE_URL` | e.g. `https://xxxxx.api.infobip.com` | not yet set |
| `INFOBIP_SMS_SENDER` | Alphanumeric SMS sender id | not yet set (defaults to `AtelierHQ` if unset — may need per-country registration) |
| `INFOBIP_WHATSAPP_SENDER` | The verified WhatsApp Business number | not yet set — `WhatsAppAdapter.supports()` returns false without it |
| `INFOBIP_RCS_SENDER` | The verified RCS agent id | not yet set — `RCSAdapter.supports()` returns false without it |
| `INFOBIP_WEBHOOK_SIGNING_KEY` | Verifies `X-Hub-Signature` on Infobip's delivery-status callbacks | not yet set |

Until these are set, every send fails cleanly with a `not_configured`
`SendResult` (see `sms.ts`/`whatsapp.ts`) rather than throwing — the
pipeline stays testable end to end without live credentials.

## Rollout

`notify_customer_status_change()` (0011) only enqueues for a tenant whose
`tenants.notify_sender_name` is set — nullable by default, so nothing goes
live for anyone until deliberately opted in. Sequence:

1. Confirm the Infobip credentials above are set and the WhatsApp/RCS
   template work above is done (or accept SMS-only delivery until it is —
   `WhatsAppAdapter`/`RCSAdapter` simply report `supports() = false`
   without their sender configured, so the fallback chain lands cleanly on
   SMS).
2. Set exactly one pilot tenant's `notify_sender_name`.
3. Advance a real order for that tenant through In Progress -> Completed
   -> Delivered and confirm `notification_outbox` shows the expected
   `sent`/`failed` outcomes, and that a delivery-status webhook (if
   configured) correctly re-falls-back on a later failure.
4. Roll out tenant by tenant from there — never flip this on globally in
   one step.
