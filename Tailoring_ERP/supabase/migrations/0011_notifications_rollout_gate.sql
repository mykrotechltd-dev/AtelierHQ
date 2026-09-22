-- ============================================================================
-- Feature-flag the notification trigger's live effect behind
-- tenants.notify_sender_name.
--
-- 0009's notify_customer_status_change() has always enqueued unconditionally
-- for every tenant the instant an eligible status change happened, with no
-- way to control rollout — meaning it went live for every shop the moment
-- 0010's pg_net trigger and real Infobip adapters shipped. This closes that
-- gap: notify_sender_name is nullable by default (0009), so nothing changes
-- for a tenant until it's deliberately set. This doubles as the
-- pilot-rollout mechanism from the architecture review's integration plan:
-- set one tenant's notify_sender_name, confirm delivery and fallback behave
-- as designed, then roll out tenant by tenant rather than flipping this on
-- globally.
--
-- Deliberately NOT gated on tenant_can_write(): a completed -> delivered
-- notification should still fire for a readonly (trial-expired) tenant's
-- already-in-progress order — withholding a "your order is ready" text
-- over a lapsed subscription is a bad failure mode, distinct from blocking
-- new writes. This keeps notification_outbox/notify-dispatch fully
-- isolated from billing either way: no shared tables, no shared secrets,
-- no shared webhook path with payments, subscription_invoices,
-- fincra-checkout, or subscription-billing.
--
-- Run once in the Supabase SQL Editor (after 0001-0010).
-- ============================================================================

create or replace function notify_customer_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template    text;
  v_phone       text;
  v_sender_name text;
begin
  v_template := case
    when old.status = 'in_progress' and new.status = 'completed' then 'order_completed'
    when old.status = 'completed'   and new.status = 'delivered' then 'order_delivered'
    else null
  end;
  if v_template is null then
    return new; -- not a customer-facing transition (e.g. received -> in_progress)
  end if;

  select notify_sender_name into v_sender_name from tenants where id = new.tenant_id;
  if v_sender_name is null then
    -- Rollout gate: this tenant hasn't been opted in yet. Silent, not an
    -- error — most tenants simply aren't enabled during a staged rollout.
    return new;
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
