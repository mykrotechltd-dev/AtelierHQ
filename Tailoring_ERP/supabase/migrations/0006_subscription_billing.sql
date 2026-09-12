-- ============================================================================
-- Part A: fix three findings from the code-review pass on the platform-admin
-- area (0004/0005), landed here rather than editing already-applied
-- migrations in place.
-- ============================================================================

-- A1. get_platform_admin_dashboard_stats() never logged its own read, unlike
-- every admin_list_*/admin_schedule/admin_quick_search RPC in 0005 — the one
-- admin read every session performs first was invisible in admin_access_log.
create or replace function get_platform_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_revenue jsonb;
  v_active_orders int;
  v_fittings_today int;
  v_fittings_week int;
  v_low_inventory int;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'currency', currency,
    'today', today,
    'week', week,
    'month', month
  ) order by month desc), '[]'::jsonb)
  into v_revenue
  from (
    select
      t.currency,
      coalesce(sum(p.amount) filter (where p.paid_at >= date_trunc('day', now())), 0) as today,
      coalesce(sum(p.amount) filter (where p.paid_at >= date_trunc('week', now())), 0) as week,
      coalesce(sum(p.amount) filter (where p.paid_at >= date_trunc('month', now())), 0) as month
    from payments p
    join tenants t on t.id = p.tenant_id
    group by t.currency
  ) rev;

  select count(*) into v_active_orders
  from orders
  where status in ('received', 'in_progress');

  select count(*) into v_fittings_today
  from fittings
  where status = 'scheduled'
    and scheduled_at >= date_trunc('day', now())
    and scheduled_at < date_trunc('day', now()) + interval '1 day';

  select count(*) into v_fittings_week
  from fittings
  where status = 'scheduled'
    and scheduled_at >= date_trunc('week', now())
    and scheduled_at < date_trunc('week', now()) + interval '1 week';

  select count(*) into v_low_inventory
  from inventory_items
  where quantity_on_hand <= reorder_threshold;

  perform log_admin_access(
    'dashboard_stats',
    null,
    v_active_orders + v_fittings_today + v_fittings_week + v_low_inventory
  );

  return jsonb_build_object(
    'revenueByCurrency', v_revenue,
    'activeOrders', v_active_orders,
    'fittingsToday', v_fittings_today,
    'fittingsThisWeek', v_fittings_week,
    'lowInventoryCount', v_low_inventory
  );
end;
$$;

-- A2. admin_list_orders returned totalAmount with no currency, so two shops
-- billing in different currencies looked like the same unit in one column.
create or replace function admin_list_orders(p_search text, p_limit int, p_offset int)
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'tenantId', o.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'orderNumber', o.order_number,
    'status', o.status,
    'dueDate', o.due_date,
    'totalAmount', o.total_amount,
    'currency', coalesce(t.currency, 'USD'),
    'customerName', coalesce(c.name, 'Unknown'),
    'garmentTypes', coalesce((
      select jsonb_agg(distinct oi.garment_type)
      from order_items oi
      where oi.order_id = o.id and oi.garment_type is not null
    ), '[]'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select * from orders
    where p_search is null or p_search = '' or order_number ilike '%' || p_search || '%'
    order by created_at desc
    offset p_offset limit p_limit
  ) o
  left join tenants t on t.id = o.tenant_id
  left join customers c on c.id = o.customer_id;

  perform log_admin_access('list_orders', p_search, jsonb_array_length(v_result));
  return v_result;
end;
$$;

-- A3. admin_quick_search's order/client subqueries and admin_list_staff's
-- per-worker "active tasks" subquery used LIMIT with no ORDER BY, so Postgres
-- had no guarantee which rows came back on repeated identical calls.
create or replace function admin_quick_search(p_term text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orders jsonb;
  v_clients jsonb;
  v_result jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'order',
    'id', o.id,
    'tenantId', o.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'title', o.order_number,
    'subtitle', coalesce(c.name, '')
  )), '[]'::jsonb)
  into v_orders
  from (
    select * from orders
    where order_number ilike '%' || p_term || '%'
    order by created_at desc, id
    limit 5
  ) o
  left join tenants t on t.id = o.tenant_id
  left join customers c on c.id = o.customer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'client',
    'id', c.id,
    'tenantId', c.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'title', c.name,
    'subtitle', 'Client'
  )), '[]'::jsonb)
  into v_clients
  from (
    select * from customers
    where name ilike '%' || p_term || '%'
    order by created_at desc, id
    limit 5
  ) c
  left join tenants t on t.id = c.tenant_id;

  v_result := v_orders || v_clients;
  perform log_admin_access('quick_search', p_term, jsonb_array_length(v_result));
  return v_result;
end;
$$;

create or replace function admin_list_staff(p_search text, p_limit int, p_offset int)
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'tenantId', w.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'name', w.name,
    'specialization', w.specialization,
    'isActive', w.is_active,
    'pendingTasks', coalesce(ts.pending, 0),
    'inProgressTasks', coalesce(ts.in_progress, 0),
    'doneTasks', coalesce(ts.done, 0),
    'activeTaskDescriptions', coalesce(ts.active_descriptions, '[]'::jsonb)
  ) order by w.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select * from workers
    where p_search is null or p_search = '' or name ilike '%' || p_search || '%'
    order by created_at desc
    offset p_offset limit p_limit
  ) w
  left join tenants t on t.id = w.tenant_id
  left join lateral (
    select
      count(*) filter (where task.status = 'pending') as pending,
      count(*) filter (where task.status = 'in_progress') as in_progress,
      count(*) filter (where task.status = 'done') as done,
      (
        select coalesce(jsonb_agg(d order by ord), '[]'::jsonb)
        from (
          select description as d, row_number() over () as ord
          from tasks
          where tasks.worker_id = w.id and tasks.status != 'done'
          order by created_at desc, id
          limit 3
        ) top3
      ) as active_descriptions
    from tasks task
    where task.worker_id = w.id
  ) ts on true;

  perform log_admin_access('list_staff', p_search, jsonb_array_length(v_result));
  return v_result;
end;
$$;

-- ============================================================================
-- Part B: 30-day free trial + Fincra-billed subscription.
--
-- Nothing in this schema currently distinguishes a paying shop from a free
-- one — every tenant gets full read/write forever. This adds a trial clock
-- starting at tenant creation and, once it lapses without a subscription,
-- moves the shop to read-only: existing data stays fully visible, but writes
-- are refused. Enforcement lives here in Postgres RLS/RPC guards, not in the
-- React app — the app ships the anon key to the browser, so a client-side
-- paywall alone would be trivially bypassed by calling PostgREST directly.
--
-- Money flows in one new direction here: shop -> platform, billed through
-- the PLATFORM's own Fincra account (credentials in edge-function secrets,
-- never in this database) — distinct from the existing per-tenant Fincra
-- checkout in supabase/functions/fincra-checkout (customer -> shop) and from
-- worker_payouts (shop -> worker).
--
-- v1 renewal is manual: the owner clicks Subscribe/Renew, pays through
-- Fincra Checkout, and the webhook extends current_period_end by one
-- interval. Fincra's only recurring primitive is a NIBSS direct-debit
-- mandate (merchant-triggered debits, 24-48h bank approval, no built-in
-- scheduler, Nigerian bank accounts only) — building auto-renew on that is
-- real additional scope, not a config flag, so it's deliberately deferred.
-- billing_mandate_ref below is reserved for that future work so it doesn't
-- require another migration to the access model.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PLANS
-- One editable plan, seeded below. Readable by any authenticated user (the
-- billing page has to show the price); no client write path — only ever
-- changed by hand in the SQL editor or a future admin-only RPC.
-- ----------------------------------------------------------------------------
create table plans (
  code          text primary key,
  name          text not null,
  amount        numeric(12,2) not null,
  currency      text not null,
  interval_days int not null default 30,
  is_active     boolean not null default true
);

-- Placeholder price — change this before going live:
--   update plans set amount = <real amount>, currency = '<real currency>' where code = 'standard';
insert into plans (code, name, amount, currency, interval_days, is_active)
values ('standard', 'AtelierHQ Standard', 5000, 'NGN', 30, true)
on conflict (code) do nothing;

alter table plans enable row level security;
create policy plans_select on plans
  for select using (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- TENANTS: trial + subscription state
-- ----------------------------------------------------------------------------
alter table tenants
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column if not exists plan_code text references plans(code),
  add column if not exists current_period_end timestamptz,
  add column if not exists billing_mandate_ref text;

-- Backfill existing shops from their actual signup date, not from today —
-- otherwise every shop that already existed before this migration would get
-- a fresh 30 days rather than continuing the trial clock they're already on.
update tenants set trial_ends_at = created_at + interval '30 days';

-- ----------------------------------------------------------------------------
-- SUBSCRIPTION INVOICES
-- One row per successful subscription payment. Written only by
-- apply_subscription_payment() below (service-role only) — no client write
-- path, matching the pattern already used for admin_access_log.
-- ----------------------------------------------------------------------------
create table subscription_invoices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  plan_code    text references plans(code),
  amount       numeric(12,2) not null,
  currency     text not null,
  reference    text not null unique,
  status       text not null default 'paid',
  period_start timestamptz not null,
  period_end   timestamptz not null,
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index subscription_invoices_tenant_idx on subscription_invoices(tenant_id, created_at desc);

alter table subscription_invoices enable row level security;
create policy subscription_invoices_select on subscription_invoices
  for select using (tenant_id = current_tenant_id());

-- ----------------------------------------------------------------------------
-- ACCESS STATE
-- Computed on every call from the current timestamp, not stored/cached —
-- so there is nothing that needs a daily cron job to "expire" anyone.
-- ----------------------------------------------------------------------------
create or replace function tenant_access_state()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when t.subscription_status = 'active'
      and t.current_period_end is not null
      and t.current_period_end > now() then 'active'
    when t.subscription_status = 'trialing' and t.trial_ends_at > now() then 'trialing'
    else 'readonly'
  end
  from tenants t
  where t.id = current_tenant_id();
$$;

create or replace function tenant_can_write()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select tenant_access_state() <> 'readonly';
$$;

-- Client-safe billing summary for the /billing page.
create or replace function get_tenant_billing_state()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tenant tenants%rowtype;
  v_plan jsonb;
  v_days_left int;
begin
  select * into v_tenant from tenants where id = current_tenant_id();
  if v_tenant.id is null then
    raise exception 'No shop found for current user';
  end if;

  select jsonb_build_object(
    'code', p.code,
    'name', p.name,
    'amount', p.amount,
    'currency', p.currency,
    'intervalDays', p.interval_days
  )
  into v_plan
  from plans p
  where p.code = coalesce(
    v_tenant.plan_code,
    (select code from plans where is_active order by code limit 1)
  );

  v_days_left := greatest(
    0,
    ceil(extract(epoch from (v_tenant.trial_ends_at - now())) / 86400)
  )::int;

  return jsonb_build_object(
    'state', tenant_access_state(),
    'subscriptionStatus', v_tenant.subscription_status,
    'trialEndsAt', v_tenant.trial_ends_at,
    'currentPeriodEnd', v_tenant.current_period_end,
    'daysLeft', v_days_left,
    'plan', v_plan
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS rewrite: split every tenant-scoped `*_all` policy into an ungated
-- SELECT and a write set gated on tenant_can_write(). Reads must never be
-- gated — the plan is explicitly "read-only lock", not "hide their data".
-- Looped so the pattern can't drift table to table.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'workers', 'orders', 'order_items', 'order_materials',
    'tasks', 'payments', 'worker_payouts', 'inventory_items', 'fittings'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_all', t);

    execute format(
      'create policy %I on %I for select using (tenant_id = current_tenant_id())',
      t || '_select', t
    );
    execute format(
      'create policy %I on %I for insert with check (tenant_id = current_tenant_id() and tenant_can_write())',
      t || '_insert', t
    );
    execute format(
      'create policy %I on %I for update using (tenant_id = current_tenant_id() and tenant_can_write()) with check (tenant_id = current_tenant_id() and tenant_can_write())',
      t || '_update', t
    );
    execute format(
      'create policy %I on %I for delete using (tenant_id = current_tenant_id() and tenant_can_write())',
      t || '_delete', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Write RPCs bypass RLS entirely (security definer), so each one needs its
-- own guard. create_tenant_for_current_user is deliberately NOT gated here
-- — that's signup, which must always be reachable.
-- ----------------------------------------------------------------------------
create or replace function create_order_with_items(
  p_customer_id uuid,
  p_due_date date,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_order_id uuid;
  v_item jsonb;
begin
  if v_tenant_id is null then
    raise exception 'No shop found for current user';
  end if;

  if not tenant_can_write() then
    raise exception 'Subscription required';
  end if;

  if not exists (select 1 from customers where id = p_customer_id and tenant_id = v_tenant_id) then
    raise exception 'Customer not found';
  end if;

  insert into orders (tenant_id, customer_id, order_number, status, due_date, notes)
  values (v_tenant_id, p_customer_id, generate_order_number(v_tenant_id), 'received', p_due_date, p_notes)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items (tenant_id, order_id, description, garment_type, fabric, quantity, unit_price, notes, measurements)
    values (
      v_tenant_id,
      v_order_id,
      v_item->>'description',
      nullif(v_item->>'garmentType', ''),
      nullif(v_item->>'fabric', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce((v_item->>'unitPrice')::numeric, 0),
      nullif(v_item->>'notes', ''),
      v_item->'measurements'
    );
  end loop;

  return v_order_id;
end;
$$;

create or replace function advance_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_status order_status;
  v_next order_status;
begin
  if not tenant_can_write() then
    raise exception 'Subscription required';
  end if;

  select status into v_status from orders where id = p_order_id and tenant_id = v_tenant_id;
  if v_status is null then
    raise exception 'Order not found';
  end if;

  v_next := case v_status
    when 'received' then 'in_progress'
    when 'in_progress' then 'completed'
    when 'completed' then 'delivered'
    else null
  end;

  if v_next is null then
    raise exception 'Order is already delivered';
  end if;

  update orders set status = v_next where id = p_order_id;
end;
$$;

create or replace function record_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method payment_method,
  p_notes text,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_order orders%rowtype;
  v_already_paid numeric;
  v_payment_id uuid;
begin
  if not tenant_can_write() then
    raise exception 'Subscription required';
  end if;

  select * into v_order from orders where id = p_order_id and tenant_id = v_tenant_id;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  select coalesce(sum(amount), 0) into v_already_paid from payments where order_id = p_order_id;

  if v_already_paid + p_amount > v_order.total_amount then
    raise exception 'Payment would exceed the order total of %. Already paid: %.', v_order.total_amount, v_already_paid;
  end if;

  insert into payments (tenant_id, customer_id, order_id, amount, method, notes, paid_at)
  values (v_tenant_id, v_order.customer_id, p_order_id, p_amount, p_method, p_notes, coalesce(p_paid_at, now()))
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function record_worker_payment(
  p_order_id uuid,
  p_worker_id uuid,
  p_amount numeric,
  p_notes text,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_payout_id uuid;
begin
  if not tenant_can_write() then
    raise exception 'Subscription required';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  if not exists (select 1 from orders where id = p_order_id and tenant_id = v_tenant_id) then
    raise exception 'Order not found';
  end if;

  if not exists (select 1 from workers where id = p_worker_id and tenant_id = v_tenant_id) then
    raise exception 'Worker not found';
  end if;

  insert into worker_payouts (tenant_id, worker_id, order_id, amount, notes, paid_at)
  values (v_tenant_id, p_worker_id, p_order_id, p_amount, p_notes, coalesce(p_paid_at, now()))
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;

create or replace function set_fincra_settings(
  p_business_id text,
  p_public_key text,
  p_secret_key text,
  p_webhook_secret text,
  p_is_live boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  if not tenant_can_write() then
    raise exception 'Subscription required';
  end if;

  if current_user_role() <> 'owner' then
    raise exception 'Only the shop owner can connect Fincra';
  end if;

  insert into fincra_settings (tenant_id, business_id, public_key, secret_key, webhook_secret, is_live, updated_at)
  values (v_tenant_id, p_business_id, p_public_key, p_secret_key, p_webhook_secret, p_is_live, now())
  on conflict (tenant_id) do update set
    business_id = excluded.business_id,
    public_key = excluded.public_key,
    secret_key = excluded.secret_key,
    webhook_secret = excluded.webhook_secret,
    is_live = excluded.is_live,
    updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- SUBSCRIPTION WEBHOOK ENTRY POINT
-- Called only by supabase/functions/subscription-billing's webhook handler,
-- using the service-role key. Explicitly revoked from PUBLIC below so no
-- tenant can call this through the client SDK and grant themselves a free
-- active subscription — unlike fincra-checkout's webhook (which inserts
-- into `payments` directly with no equivalent function to lock down), this
-- is a single atomic transaction: idempotent on `reference`, and it extends
-- from the later of "now" or the existing current_period_end so an
-- early renewal adds on top of remaining time instead of discarding it.
-- ----------------------------------------------------------------------------
create or replace function apply_subscription_payment(
  p_tenant_id uuid,
  p_plan_code text,
  p_amount numeric,
  p_currency text,
  p_reference text,
  p_interval_days int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if exists (select 1 from subscription_invoices where reference = p_reference) then
    return false;
  end if;

  select greatest(now(), coalesce(current_period_end, now()))
  into v_period_start
  from tenants where id = p_tenant_id;

  if v_period_start is null then
    raise exception 'Shop not found';
  end if;

  v_period_end := v_period_start + make_interval(days => p_interval_days);

  insert into subscription_invoices (tenant_id, plan_code, amount, currency, reference, status, period_start, period_end, paid_at)
  values (p_tenant_id, p_plan_code, p_amount, p_currency, p_reference, 'paid', v_period_start, v_period_end, now());

  update tenants
  set subscription_status = 'active',
      plan_code = p_plan_code,
      current_period_end = v_period_end
  where id = p_tenant_id;

  return true;
end;
$$;

revoke execute on function apply_subscription_payment(uuid, text, numeric, text, text, int) from public;
grant execute on function apply_subscription_payment(uuid, text, numeric, text, text, int) to service_role;

-- ----------------------------------------------------------------------------
-- PLATFORM ADMIN: shop subscription visibility + manual override
-- The manual-renewal model guarantees occasional human intervention (a shop
-- pays late by bank transfer, a payment needs comping) — the admin area had
-- no tenant list at all before this.
-- ----------------------------------------------------------------------------
create or replace function admin_list_tenants(p_search text, p_limit int, p_offset int)
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'currency', t.currency,
    'createdAt', t.created_at,
    'subscriptionStatus', t.subscription_status,
    'accessState', case
      when t.subscription_status = 'active'
        and t.current_period_end is not null
        and t.current_period_end > now() then 'active'
      when t.subscription_status = 'trialing' and t.trial_ends_at > now() then 'trialing'
      else 'readonly'
    end,
    'trialEndsAt', t.trial_ends_at,
    'currentPeriodEnd', t.current_period_end,
    'planCode', t.plan_code
  ) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select * from tenants
    where p_search is null or p_search = '' or name ilike '%' || p_search || '%'
    order by created_at desc
    offset p_offset limit p_limit
  ) t;

  perform log_admin_access('list_tenants', p_search, jsonb_array_length(v_result));
  return v_result;
end;
$$;

create or replace function admin_set_tenant_subscription(
  p_tenant_id uuid,
  p_status text,
  p_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('trialing', 'active', 'past_due', 'canceled') then
    raise exception 'Invalid subscription status: %', p_status;
  end if;

  update tenants
  set subscription_status = p_status,
      current_period_end = p_period_end
  where id = p_tenant_id;

  if not found then
    raise exception 'Shop not found';
  end if;

  perform log_admin_access(
    'set_tenant_subscription',
    p_tenant_id::text || ' -> ' || p_status,
    1
  );
end;
$$;
