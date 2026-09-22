-- ============================================================================
-- Unified customer messaging (SMS / WhatsApp / RCS), triggered by order
-- status changes. Run once in the Supabase SQL Editor (after 0001-0008).
--
-- Design notes (see the messaging architecture review):
--  * The trigger below is the single source of truth for "an order changed
--    status" — it fires for every write path (the advance_order_status RPC,
--    a future admin override, anything else), not just the one button in
--    the order detail page today.
--  * It never calls out over HTTP itself. It inserts one row into
--    notification_outbox, in the SAME transaction as the status change, so
--    an order can never show "Completed" with the notification silently
--    lost, and a rolled-back status change never leaves a stray outbox row.
--  * notification_outbox has RLS enabled and NO client policies — same
--    convention as activity_events (0008_activity_and_audit.sql): nothing
--    with a client role can read or write it, only the service-role Edge
--    Function (supabase/functions/notify-dispatch) does.
--  * Logging/notifying never blocks the business write: the trigger
--    swallows its own errors, same convention as log_activity() in 0008.
--  * Only in_progress -> completed and completed -> delivered notify. The
--    first hop (received -> in_progress) is an internal "work started"
--    event the customer doesn't need pinged for.
--  * A null/blank phone is not an error — it's logged as a 'skipped' row
--    with a reason, so the business write is never blocked and the gap is
--    still visible (matches "was my customer actually notified?" in the
--    admin console, not a silent no-op).
--
-- Manual setup after running this file (no supabase/config.toml in this
-- project — Database Webhooks are dashboard/CLI config, not SQL):
--   1. Deploy the dispatcher (--no-verify-jwt: this function is only ever
--      called by Supabase's own webhook infrastructure, never a browser, so
--      there is no user JWT to verify):
--        npx supabase functions deploy notify-dispatch --no-verify-jwt
--   2. The "Webhooks" page isn't in the Database sidebar in current
--      dashboard versions — reach it via the dashboard search (Ctrl+K,
--      search "webhooks") or by navigating directly to
--      /project/<ref>/database/hooks. Create a new database webhook:
--        Table:        notification_outbox
--        Events:       Insert
--        Type:         Supabase Edge Functions
--        Function:     notify-dispatch
--      There is no field to add a path suffix — this webhook type always
--      calls the function's bare base URL, which is why index.ts routes on
--      "any POST to the root" rather than a specific path. The dashboard
--      auto-fills an Authorization: Bearer header; leave it — the function
--      never reads it, since verify_jwt is off.
--      This is deliberately a Database Webhook, not a raw trigger calling
--      pg_net directly (pg_net is not enabled in this project — only
--      pgcrypto is, see schema.sql:8): Supabase's own webhook delivery
--      retries non-2xx responses with backoff, giving the outbox -> Edge
--      Function leg retry behaviour for free instead of hand-rolling one.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COLUMNS THE NOTIFICATION FLOW NEEDS
-- ----------------------------------------------------------------------------

-- Per-tenant branding text interpolated into message templates (e.g. "Message
-- from {shop_name} via AtelierHQ") — the WhatsApp/RCS sender identity itself
-- stays a single, platform-verified account; nullable because unset tenants
-- simply don't get notifications yet (see notify_customer_status_change()).
alter table tenants
  add column if not exists notify_sender_name text;

-- Meta requires documented, affirmative opt-in before a business can message
-- a customer on WhatsApp at all — "we have their phone number" is not
-- sufficient consent. Defaults to false: opt-in is something a tailor
-- captures explicitly at customer intake, never assumed for existing rows.
alter table customers
  add column if not exists whatsapp_opt_in boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION OUTBOX
-- ----------------------------------------------------------------------------
create table if not exists notification_outbox (
  id                  bigint generated always as identity primary key,
  tenant_id           uuid not null references tenants(id) on delete cascade,
  order_id            uuid not null references orders(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  to_status           order_status not null,
  template_key        text not null,
  params              jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  channel_used        text,                    -- 'whatsapp' | 'rcs' | 'sms', set on send
  provider_message_id text,
  attempt_count       int not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);
create index if not exists notification_outbox_tenant_idx
  on notification_outbox (tenant_id, created_at desc);
create index if not exists notification_outbox_pending_idx
  on notification_outbox (created_at) where status = 'pending';
-- One notification per order per transition: advance_order_status only
-- permits one forward step at a time (schema.sql), so a given order can
-- reach a given to_status at most once — this is the outbox's natural
-- idempotency key, same role payments.external_reference's unique
-- constraint plays for Fincra webhook replays.
create unique index if not exists notification_outbox_order_status_uidx
  on notification_outbox (order_id, to_status);

alter table notification_outbox enable row level security;
-- no policies on purpose — only notify-dispatch's service-role client and
-- the trigger below (security definer) ever touch this table.

-- ----------------------------------------------------------------------------
-- 3. TRIGGER: enqueue on customer-notable status changes
-- ----------------------------------------------------------------------------
create or replace function notify_customer_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template text;
  v_phone    text;
begin
  v_template := case
    when old.status = 'in_progress' and new.status = 'completed' then 'order_completed'
    when old.status = 'completed'   and new.status = 'delivered' then 'order_delivered'
    else null
  end;
  if v_template is null then
    return new; -- not a customer-facing transition (e.g. received -> in_progress)
  end if;

  select phone into v_phone from customers where id = new.customer_id;

  if v_phone is null or btrim(v_phone) = '' then
    insert into notification_outbox
      (tenant_id, order_id, customer_id, to_status, template_key, status, last_error)
    values
      (new.tenant_id, new.id, new.customer_id, new.status, v_template, 'skipped', 'no phone on file')
    on conflict (order_id, to_status) do nothing;
    return new;
  end if;

  insert into notification_outbox
    (tenant_id, order_id, customer_id, to_status, template_key, status)
  values
    (new.tenant_id, new.id, new.customer_id, new.status, v_template, 'pending')
  on conflict (order_id, to_status) do nothing;

  return new;
exception when others then
  -- Same convention as log_activity() in 0008: notifying must never block
  -- the order-status write it describes.
  return new;
end;
$$;

drop trigger if exists notify_customer_status_change on orders;
create trigger notify_customer_status_change
  after update on orders
  for each row
  when (old.status is distinct from new.status)
  execute function notify_customer_status_change();
