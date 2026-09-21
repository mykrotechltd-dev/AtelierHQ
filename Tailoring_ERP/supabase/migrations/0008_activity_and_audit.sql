-- ============================================================================
-- Platform monitoring: user activity, a readable audit trail, and the
-- audited admin functions that serve the admin console.
--
-- Run once in the Supabase SQL Editor (after 0001-0007).
--
-- Design notes (see the admin console design doc):
--  * Activity is captured by triggers on the business tables, so identity and
--    shop are recorded server-side and the UI cannot skip or forge them.
--  * Logging never blocks a business write: the trigger swallows its own
--    errors.
--  * activity_events has RLS enabled and NO policies. Nothing with a client
--    role can read or write it; only security-definer functions do.
--  * Every admin read goes through a function that checks is_platform_admin()
--    and writes to admin_access_log, the pattern from 0005. The live-stream
--    poll (p_after is set) is the one exception: it is not logged, or the
--    audit log would fill with one row every few seconds.
--  * NOT enforced here: a second factor. Requiring aal2 inside
--    is_platform_admin() would lock every admin out until they have enrolled
--    an authenticator, so that switch belongs in a separate, deliberate step.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUDIT LOG HARDENING
-- ----------------------------------------------------------------------------
alter table admin_access_log
  add column if not exists reason           text,
  add column if not exists target_tenant_id uuid references tenants(id) on delete set null,
  add column if not exists ip               inet;

-- Client IP as PostgREST exposes it to Postgres. Never raises: a missing or
-- malformed header simply yields null.
create or replace function request_ip()
returns inet
language plpgsql
stable
as $$
declare
  v text;
begin
  v := split_part(
         coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
         ',', 1);
  return nullif(btrim(v), '')::inet;
exception when others then
  return null;
end;
$$;

-- Audit rows cannot be edited. (Deleting an admin still cascades their rows;
-- that is a deliberate, owner-level action, not something the app can do.)
create or replace function admin_access_log_no_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_access_log is append-only';
end;
$$;

drop trigger if exists admin_access_log_no_update on admin_access_log;
create trigger admin_access_log_no_update
  before update on admin_access_log
  for each row execute function admin_access_log_no_update();

create or replace function log_admin_access(p_action text, p_detail text, p_row_count int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into admin_access_log (admin_id, action, detail, row_count, ip)
  values (auth.uid(), p_action, p_detail, p_row_count, request_ip());
$$;

-- Same, with the shop the action was about and the reason given for it.
create or replace function log_admin_access_ex(
  p_action text, p_detail text, p_row_count int, p_tenant uuid, p_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into admin_access_log
    (admin_id, action, detail, row_count, target_tenant_id, reason, ip)
  values
    (auth.uid(), p_action, p_detail, p_row_count, p_tenant, p_reason, request_ip());
$$;

-- ----------------------------------------------------------------------------
-- 2. ACTIVITY EVENTS
-- ----------------------------------------------------------------------------
create table if not exists activity_events (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  actor_id    uuid,                                  -- null for system writes (webhooks)
  actor_role  text not null default 'member',        -- owner | worker | system
  action      text not null,                         -- order.created, payment.created, ...
  category    text not null,                         -- orders | payments | customers | team
  resource    text,                                  -- order number or row id, never a name
  metadata    jsonb not null default '{}'::jsonb,    -- amounts and status changes only
  ip          inet,
  created_at  timestamptz not null default now()
);
create index if not exists activity_events_created_idx on activity_events (created_at desc);
create index if not exists activity_events_tenant_idx  on activity_events (tenant_id, created_at desc);

alter table activity_events enable row level security;
-- no policies on purpose

create or replace function log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind  text := tg_argv[0];
  v_row   jsonb;
  v_old   jsonb;
  v_tenant uuid;
  v_verb  text;
  v_meta  jsonb := '{}'::jsonb;
  v_role  text;
  v_cat   text;
begin
  begin
    if tg_op = 'DELETE' then
      v_row := to_jsonb(old);
    else
      v_row := to_jsonb(new);
    end if;
    v_tenant := (v_row ->> 'tenant_id')::uuid;
    if v_tenant is null then
      return null;
    end if;

    if tg_op = 'INSERT' then
      v_verb := 'created';
    elsif tg_op = 'DELETE' then
      v_verb := 'deleted';
    else
      -- Updates only matter for things that move through a workflow, and only
      -- when the status changes; logging every edit would drown the feed.
      if v_kind in ('order', 'task') then
        v_old := to_jsonb(old);
        if (v_old ->> 'status') is not distinct from (v_row ->> 'status') then
          return null;
        end if;
        v_verb := 'status_changed';
        v_meta := jsonb_build_object('from', v_old ->> 'status', 'to', v_row ->> 'status');
      else
        v_verb := 'updated';
      end if;
    end if;

    if v_kind in ('payment', 'payout') and tg_op = 'INSERT' then
      v_meta := jsonb_build_object('amount', v_row -> 'amount');
    end if;

    v_cat := case v_kind
      when 'order'    then 'orders'
      when 'payment'  then 'payments'
      when 'payout'   then 'payments'
      when 'customer' then 'customers'
      else 'team'
    end;

    if auth.uid() is null then
      v_role := 'system';
    else
      v_role := coalesce((select role::text from profiles where id = auth.uid()), 'member');
    end if;

    insert into activity_events
      (tenant_id, actor_id, actor_role, action, category, resource, metadata, ip)
    values
      (v_tenant, auth.uid(), v_role, v_kind || '.' || v_verb, v_cat,
       coalesce(v_row ->> 'order_number', v_row ->> 'id'), v_meta, request_ip());
  exception when others then
    -- Logging must never block the business write it describes.
    null;
  end;
  return null;
end;
$$;

drop trigger if exists orders_activity          on orders;
drop trigger if exists customers_activity       on customers;
drop trigger if exists workers_activity         on workers;
drop trigger if exists tasks_activity           on tasks;
drop trigger if exists payments_activity        on payments;
drop trigger if exists worker_payouts_activity  on worker_payouts;

create trigger orders_activity         after insert or update or delete on orders
  for each row execute function log_activity('order');
create trigger customers_activity      after insert or update or delete on customers
  for each row execute function log_activity('customer');
create trigger workers_activity        after insert or update or delete on workers
  for each row execute function log_activity('worker');
create trigger tasks_activity          after insert or update or delete on tasks
  for each row execute function log_activity('task');
create trigger payments_activity       after insert or delete on payments
  for each row execute function log_activity('payment');
create trigger worker_payouts_activity after insert or delete on worker_payouts
  for each row execute function log_activity('payout');

-- ----------------------------------------------------------------------------
-- 3. ADMIN FUNCTIONS
-- ----------------------------------------------------------------------------

-- Activity across every shop. p_after set = live-stream poll (newer than that
-- id, not logged). p_after null = a real read, logged.
create or replace function admin_list_activity(
  p_category text, p_tenant uuid, p_search text, p_after bigint, p_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(x.obj order by x.id desc), '[]'::jsonb)
  into v_result
  from (
    select
      e.id,
      jsonb_build_object(
        'id', e.id,
        'createdAt', e.created_at,
        'tenantId', e.tenant_id,
        'tenantName', coalesce(t.name, 'Unknown shop'),
        'actorEmail', u.email,
        'actorRole', e.actor_role,
        'action', e.action,
        'category', e.category,
        'resource', e.resource,
        'metadata', e.metadata,
        'ip', host(e.ip)
      ) as obj
    from activity_events e
    left join tenants t on t.id = e.tenant_id
    left join auth.users u on u.id = e.actor_id
    where (p_category is null or p_category = '' or e.category = p_category)
      and (p_tenant is null or e.tenant_id = p_tenant)
      and (p_after is null or e.id > p_after)
      and (p_search is null or p_search = ''
           or (e.action || ' ' || coalesce(e.resource, '') || ' '
               || coalesce(u.email, '') || ' ' || coalesce(t.name, ''))
              ilike '%' || p_search || '%')
    order by e.id desc
    limit v_limit
  ) x;

  if p_after is null then
    perform log_admin_access_ex(
      'list_activity',
      concat_ws(' | ', nullif(p_category, ''), nullif(p_search, '')),
      jsonb_array_length(v_result), p_tenant, null);
  end if;
  return v_result;
end;
$$;

-- The audit trail itself.
create or replace function admin_list_audit_log(p_limit int, p_offset int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(x.obj order by x.id desc), '[]'::jsonb)
  into v_result
  from (
    select
      l.id,
      jsonb_build_object(
        'id', l.id,
        'createdAt', l.created_at,
        'adminEmail', coalesce(pa.email, u.email),
        'action', l.action,
        'detail', l.detail,
        'rowCount', l.row_count,
        'reason', l.reason,
        'targetTenantName', t.name,
        'ip', host(l.ip)
      ) as obj
    from admin_access_log l
    left join platform_admins pa on pa.id = l.admin_id
    left join auth.users u on u.id = l.admin_id
    left join tenants t on t.id = l.target_tenant_id
    order by l.id desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) x;

  perform log_admin_access('list_audit_log', null, jsonb_array_length(v_result));
  return v_result;
end;
$$;

-- Headline figures for the console overview. Money is grouped by currency and
-- never summed across currencies.
create or replace function admin_platform_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shops   jsonb;
  v_mrr     jsonb;
  v_risk    jsonb;
  v_hours   jsonb;
  v_weekly  jsonb;
  v_ev24    bigint;
  v_active7 bigint;
  v_lagos_midnight timestamptz :=
    date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total',    count(*),
    'active',   count(*) filter (where subscription_status = 'active'),
    'trialing', count(*) filter (where subscription_status = 'trialing'),
    'pastDue',  count(*) filter (where subscription_status = 'past_due'),
    'canceled', count(*) filter (where subscription_status = 'canceled'),
    'trialsEndingSoon', count(*) filter (
      where subscription_status = 'trialing'
        and trial_ends_at between now() and now() + interval '7 days')
  ) into v_shops from tenants;

  select coalesce(jsonb_agg(jsonb_build_object('currency', m.currency, 'amount', m.amount)), '[]'::jsonb)
  into v_mrr
  from (
    select p.currency, round(sum(p.amount * 30.0 / greatest(p.interval_days, 1)), 2) as amount
    from tenants t join plans p on p.code = t.plan_code
    where t.subscription_status = 'active'
    group by p.currency
  ) m;

  select coalesce(jsonb_agg(jsonb_build_object('currency', m.currency, 'amount', m.amount)), '[]'::jsonb)
  into v_risk
  from (
    select p.currency, round(sum(p.amount * 30.0 / greatest(p.interval_days, 1)), 2) as amount
    from tenants t join plans p on p.code = t.plan_code
    where t.subscription_status = 'past_due'
    group by p.currency
  ) m;

  select count(*) into v_ev24 from activity_events where created_at > now() - interval '24 hours';
  select count(distinct tenant_id) into v_active7 from activity_events where created_at > now() - interval '7 days';

  select coalesce(jsonb_agg(coalesce(c.n, 0) order by g.h), '[]'::jsonb)
  into v_hours
  from generate_series(0, 23) as g(h)
  left join (
    select extract(hour from created_at at time zone 'Africa/Lagos')::int as hr, count(*) as n
    from activity_events
    where created_at >= v_lagos_midnight
    group by 1
  ) c on c.hr = g.h;

  select coalesce(jsonb_agg(jsonb_build_object(
           'weekStart', w.wk::date, 'newShops', coalesce(s.n, 0), 'payingShops', coalesce(i.n, 0)
         ) order by w.wk), '[]'::jsonb)
  into v_weekly
  from (
    select generate_series(
      date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as wk
  ) w
  left join (select date_trunc('week', created_at) as wk, count(*) as n from tenants group by 1) s on s.wk = w.wk
  left join (select date_trunc('week', paid_at) as wk, count(distinct tenant_id) as n
             from subscription_invoices group by 1) i on i.wk = w.wk;

  perform log_admin_access('platform_overview', null, 1);

  return jsonb_build_object(
    'shops', v_shops,
    'mrr', v_mrr,
    'mrrAtRisk', v_risk,
    'events24h', v_ev24,
    'activeShops7d', v_active7,
    'eventsByHour', v_hours,
    'weekly', v_weekly
  );
end;
$$;

-- One score per shop, from four signals. Formulas are plain on purpose so the
-- console can explain them. 71+ healthy, 41-70 watch, 0-40 at risk.
--   activity 30%  events in 14 days, log scale, full marks at 50
--   orders   25%  orders in the last 30 days against the 30 before
--   payment  30%  active or trialing 100, past due 20, canceled 0
--   team     15%  distinct people active in 14 days against team size
create or replace function admin_tenant_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  with ev as (
    select tenant_id,
           count(*) filter (where created_at > now() - interval '14 days') as ev14,
           count(distinct actor_id) filter (where created_at > now() - interval '14 days') as actors14,
           max(created_at) as last_at
    from activity_events group by tenant_id
  ), ord as (
    select tenant_id,
           count(*) filter (where created_at > now() - interval '30 days') as o30,
           count(*) filter (where created_at <= now() - interval '30 days'
                              and created_at >  now() - interval '60 days') as o60
    from orders group by tenant_id
  ), wk as (
    select tenant_id, count(*) as n from workers group by tenant_id
  ), base as (
    select t.id, t.subscription_status as st,
           coalesce(ev.ev14, 0)::numeric as ev14, coalesce(ev.actors14, 0)::numeric as actors14, ev.last_at,
           coalesce(ord.o30, 0)::numeric as o30, coalesce(ord.o60, 0)::numeric as o60,
           coalesce(wk.n, 0)::numeric as workers
    from tenants t
    left join ev  on ev.tenant_id  = t.id
    left join ord on ord.tenant_id = t.id
    left join wk  on wk.tenant_id  = t.id
  ), scored as (
    select b.*,
      round(least(100, 100 * ln(1 + b.ev14) / ln(51)))::int as f_activity,
      (case when b.o30 = 0 and b.o60 = 0 then 0
            when b.o60 = 0 then 80
            else greatest(0, least(100, 50 + 50 * (b.o30 - b.o60) / b.o60)) end)::int as f_orders,
      (case b.st when 'active' then 100 when 'trialing' then 100 when 'past_due' then 20 else 0 end) as f_payment,
      round(least(100, 100 * b.actors14 / greatest(1, b.workers + 1)))::int as f_team
    from base b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tenantId', s.id,
           'score', round(0.30 * s.f_activity + 0.25 * s.f_orders + 0.30 * s.f_payment + 0.15 * s.f_team)::int,
           'factors', jsonb_build_object(
             'activity', s.f_activity, 'orders', s.f_orders, 'payment', s.f_payment, 'team', s.f_team),
           'events14d', s.ev14::int,
           'orders30d', s.o30::int,
           'lastActiveAt', s.last_at
         )), '[]'::jsonb)
  into v_result
  from scored s;

  perform log_admin_access('tenant_health', null, jsonb_array_length(v_result));
  return v_result;
end;
$$;

-- Recent subscription payments, confirmed by the Fincra webhook.
create or replace function admin_recent_payments(p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(x.obj order by x.paid_at desc), '[]'::jsonb)
  into v_result
  from (
    select i.paid_at,
           jsonb_build_object(
             'id', i.id,
             'paidAt', i.paid_at,
             'tenantName', coalesce(t.name, 'Unknown shop'),
             'planCode', i.plan_code,
             'amount', i.amount,
             'currency', i.currency,
             'reference', i.reference
           ) as obj
    from subscription_invoices i
    left join tenants t on t.id = i.tenant_id
    order by i.paid_at desc
    limit least(greatest(coalesce(p_limit, 10), 1), 100)
  ) x;

  perform log_admin_access('recent_payments', null, jsonb_array_length(v_result));
  return v_result;
end;
$$;

grant execute on function
  admin_list_activity(text, uuid, text, bigint, int),
  admin_list_audit_log(int, int),
  admin_platform_overview(),
  admin_tenant_health(),
  admin_recent_payments(int)
to authenticated;
