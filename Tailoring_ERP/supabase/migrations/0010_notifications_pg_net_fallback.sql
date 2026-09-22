-- ============================================================================
-- Fallback delivery path for notify-dispatch.
--
-- The Supabase Dashboard's "Database Webhooks -> Supabase Edge Functions"
-- trigger type failed to create on this project with:
--   ERROR: 3F000: schema "supabase_functions" does not exist
-- That schema is Supabase's own internal bootstrap for the dashboard-managed
-- webhook feature. Some projects never had it provisioned, and it isn't
-- something fixable from ordinary SQL here (its objects want an owning
-- role, supabase_functions_admin, that a normal SQL Editor session doesn't
-- have rights to create or assign).
--
-- Run once in the Supabase SQL Editor (after 0001-0009).
--
-- This migration enables pg_net directly and adds our own trigger calling
-- notify-dispatch's Edge Function over net.http_post, bypassing
-- supabase_functions entirely. It builds the identical JSON shape
-- (type/table/schema/record) the dashboard-managed webhook would have sent,
-- so supabase/functions/notify-dispatch/index.ts needs no changes at all.
--
-- Trade-off, stated plainly: the Dashboard's Database Webhooks retry
-- non-2xx responses with backoff automatically; a raw net.http_post call
-- does not (it's fire-and-forget) — this is exactly the reliability gap
-- the architecture review originally chose the Dashboard-managed webhook to
-- avoid. Accepted here because the Dashboard feature is unavailable on this
-- project. If Supabase support later provisions supabase_functions and the
-- Dashboard webhook starts working, it can be created alongside this
-- trigger with no conflict: notify-dispatch already treats any call for a
-- row that isn't still 'pending' as a no-op (index.ts), so a double
-- delivery from both paths firing is harmless, not a bug to fix.
--
-- pg_net_request_id is stored on the outbox row purely for debugging: once
-- pg_net delivers the request, its logged response can be inspected with:
--   select * from net._http_response where id = <pg_net_request_id>;
-- ============================================================================

create extension if not exists pg_net;

alter table notification_outbox
  add column if not exists pg_net_request_id bigint;

create or replace function dispatch_notification_via_pg_net()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id bigint;
begin
  select net.http_post(
    url     := 'https://yqersdeyslycfprplxer.supabase.co/functions/v1/notify-dispatch',
    body    := jsonb_build_object(
                 'type', 'INSERT',
                 'table', 'notification_outbox',
                 'schema', 'public',
                 'record', to_jsonb(new)
               ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) into v_request_id;

  update notification_outbox set pg_net_request_id = v_request_id where id = new.id;

  return new;
exception when others then
  -- Same rule as notify_customer_status_change(): a delivery hiccup must
  -- never break the outbox insert it's trying to deliver.
  return new;
end;
$$;

drop trigger if exists dispatch_notification_via_pg_net on notification_outbox;
create trigger dispatch_notification_via_pg_net
  after insert on notification_outbox
  for each row
  execute function dispatch_notification_via_pg_net();
