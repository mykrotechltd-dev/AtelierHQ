-- ============================================================================
-- AtelierHQ (Tailoring_Shop_ERP) — Supabase schema
-- Migrated from Convex. Tenant isolation: every business table carries a
-- tenant_id, and Row Level Security enforces that a session can only ever
-- read/write rows belonging to its own tenant.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type user_role      as enum ('owner', 'worker');
create type order_status   as enum ('received', 'in_progress', 'completed', 'delivered');
create type task_status    as enum ('pending', 'in_progress', 'done');
create type payment_method as enum ('cash', 'bank_transfer', 'card', 'other', 'stripe', 'fincra');
create type inventory_category as enum ('fabric', 'thread', 'button', 'other');
create type fitting_status as enum ('scheduled', 'completed', 'cancelled');

-- ----------------------------------------------------------------------------
-- PLANS
-- One editable plan, seeded below. Readable by any authenticated user (the
-- billing page has to show the price); no client write path.
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

-- ----------------------------------------------------------------------------
-- TENANTS  (one row per tailoring business)
--
-- trial_ends_at / subscription_status / plan_code / current_period_end
-- back a 30-day free trial: tenant_access_state() (below) computes whether
-- writes are allowed from these plus now(), so nothing needs a cron job to
-- "expire" anyone. billing_mandate_ref is reserved for a future Fincra
-- direct-debit auto-renew path and unused by v1's manual-renewal flow.
-- ----------------------------------------------------------------------------
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  currency    text not null default 'USD',
  owner_id    uuid,                      -- set after the owner profile is created
  trial_ends_at        timestamptz not null default (now() + interval '30 days'),
  subscription_status  text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  plan_code            text references plans(code),
  current_period_end   timestamptz,
  billing_mandate_ref  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PROFILES  (extends auth.users; one row per login, owner or worker)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'owner',
  created_at  timestamptz not null default now()
);
create index profiles_tenant_idx on profiles(tenant_id);

alter table tenants add constraint tenants_owner_fk
  foreign key (owner_id) references profiles(id) deferrable initially deferred;

-- ----------------------------------------------------------------------------
-- helper: resolve the caller's tenant + role without recursive RLS lookups
-- ----------------------------------------------------------------------------
create or replace function current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from profiles where id = auth.uid();
$$;

create or replace function current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- helper: trial/subscription access gate. Computed live from now(), not
-- cached — a shop needs no cron job to "expire" it. 'readonly' means the
-- trial lapsed with no active subscription: reads stay open (see the RLS
-- policies below), writes are refused.
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

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  name          text not null,
  phone         text,
  email         text,
  notes         text,
  measurements  jsonb,   -- {chest, waist, hips, shoulder, sleeveLength, inseam, neck, thigh, height, weight, notes}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customers_tenant_idx on customers(tenant_id);
create index customers_search_idx on customers using gin (to_tsvector('simple', name));

-- ----------------------------------------------------------------------------
-- WORKERS
-- ----------------------------------------------------------------------------
create table workers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,
  name            text not null,
  phone           text,
  specialization  text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index workers_tenant_idx on workers(tenant_id);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
create table orders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  customer_id   uuid not null references customers(id),
  order_number  text not null,
  status        order_status not null default 'received',
  due_date      date,
  total_amount  numeric(12,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, order_number)
);
create index orders_tenant_idx on orders(tenant_id);
create index orders_customer_idx on orders(customer_id);
create index orders_tenant_status_idx on orders(tenant_id, status);

-- ----------------------------------------------------------------------------
-- ORDER ITEMS
-- ----------------------------------------------------------------------------
create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  tenant_id     uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  description   text not null,
  garment_type  text,
  fabric        text,
  quantity      numeric(12,2) not null default 1,
  unit_price    numeric(12,2) not null default 0,
  notes         text,
  measurements  jsonb,   -- frozen per-garment measurement snapshot, never re-synced from customers.measurements
  created_at    timestamptz not null default now()
);
create index order_items_order_idx on order_items(order_id);
create index order_items_tenant_idx on order_items(tenant_id);

-- ----------------------------------------------------------------------------
-- ORDER MATERIALS  (bill of materials, per garment/order item)
-- ----------------------------------------------------------------------------
create table order_materials (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  order_item_id  uuid not null references order_items(id) on delete cascade,
  name           text not null,
  quantity       numeric(12,2) not null default 1,
  unit_price     numeric(12,2) not null default 0,
  line_total     numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at     timestamptz not null default now()
);
create index order_materials_tenant_idx on order_materials(tenant_id);
create index order_materials_item_idx on order_materials(order_item_id);

-- ----------------------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------------------
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  order_item_id   uuid references order_items(id) on delete set null,
  worker_id       uuid not null references workers(id),
  description     text not null,
  status          task_status not null default 'pending',
  due_date        date,
  completed_at    timestamptz,
  payout          numeric(12,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_tenant_idx on tasks(tenant_id);
create index tasks_order_idx on tasks(order_id);
create index tasks_worker_idx on tasks(worker_id);
create index tasks_tenant_status_idx on tasks(tenant_id, status);

-- ----------------------------------------------------------------------------
-- PAYMENTS  (customer payments toward an order)
-- ----------------------------------------------------------------------------
create table payments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  customer_id   uuid not null references customers(id),
  order_id      uuid not null references orders(id),
  amount        numeric(12,2) not null check (amount > 0),
  method        payment_method not null default 'cash',
  notes         text,
  paid_at       timestamptz not null default now(),
  -- set only for Stripe payments, by the stripe-connect edge function's webhook
  external_reference text,
  charged_currency   text,
  charged_amount     numeric(12,2)
);
create index payments_tenant_idx on payments(tenant_id);
create index payments_order_idx on payments(order_id);
create index payments_customer_idx on payments(customer_id);

-- ----------------------------------------------------------------------------
-- WORKER PAYOUTS
-- ----------------------------------------------------------------------------
create table worker_payouts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  worker_id   uuid not null references workers(id),
  order_id    uuid references orders(id),   -- nullable: payouts predating job costing have no order
  amount      numeric(12,2) not null check (amount > 0),
  notes       text,
  paid_at     timestamptz not null default now()
);
create index worker_payouts_tenant_idx on worker_payouts(tenant_id);
create index worker_payouts_worker_idx on worker_payouts(worker_id);
create index worker_payouts_order_idx on worker_payouts(order_id);

-- ----------------------------------------------------------------------------
-- FINCRA SETTINGS  (per-tenant Fincra credentials — each shop connects its
-- own Fincra business account directly, since Fincra has no confirmed public
-- API for a platform to create per-tenant sub-accounts). RLS is enabled with
-- ZERO policies: no client role can select/insert/update/delete this table
-- directly — only set_fincra_settings()/get_fincra_settings_public() below,
-- and the fincra-checkout edge function via the service-role key.
-- ----------------------------------------------------------------------------
create table fincra_settings (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
  business_id     text not null,
  public_key      text not null,
  secret_key      text not null,
  webhook_secret  text not null,
  is_live         boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SUBSCRIPTION INVOICES  (shop -> platform: one row per successful
-- subscription payment, distinct from `payments` which is customer -> shop).
-- Written only by apply_subscription_payment() below, called only from
-- supabase/functions/subscription-billing's webhook via the service-role
-- key — no client write path, matching admin_access_log's pattern.
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

-- ----------------------------------------------------------------------------
-- INVENTORY ITEMS  (shop-wide raw material stock, distinct from
-- order_materials' per-order bill of materials)
-- ----------------------------------------------------------------------------
create table inventory_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  name               text not null,
  category           inventory_category not null default 'other',
  unit               text not null default 'unit',
  quantity_on_hand   numeric(12,2) not null default 0,
  reorder_threshold  numeric(12,2) not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index inventory_items_tenant_idx on inventory_items(tenant_id);

-- ----------------------------------------------------------------------------
-- FITTINGS  (fitting appointments; separate from orders.due_date, which is
-- the delivery date)
-- ----------------------------------------------------------------------------
create table fittings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default current_tenant_id() references tenants(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  order_id      uuid references orders(id) on delete set null,
  scheduled_at  timestamptz not null,
  status        fitting_status not null default 'scheduled',
  notes         text,
  created_at    timestamptz not null default now()
);
create index fittings_tenant_idx on fittings(tenant_id);
create index fittings_scheduled_idx on fittings(tenant_id, scheduled_at);

-- ----------------------------------------------------------------------------
-- PLATFORM ADMINS  (the SaaS operator's own staff — not a tenant user, has
-- no tenant_id, never granted through tenant signup/onboarding). RLS is
-- enabled with ZERO client-facing policies: only is_platform_admin() and
-- get_platform_admin_dashboard_stats() (both security definer) ever read it.
-- ----------------------------------------------------------------------------
create table platform_admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from platform_admins where id = auth.uid());
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tenants_updated_at before update on tenants
  for each row execute function set_updated_at();
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger trg_inventory_items_updated_at before update on inventory_items
  for each row execute function set_updated_at();

-- recompute orders.total_amount whenever order_items change
create or replace function recalc_order_total()
returns trigger language plpgsql as $$
declare
  target_order uuid := coalesce(new.order_id, old.order_id);
begin
  update orders
    set total_amount = coalesce((
      select sum(quantity * unit_price) from order_items where order_id = target_order
    ), 0)
    where id = target_order;
  return null;
end;
$$;

create trigger trg_order_items_recalc
  after insert or update or delete on order_items
  for each row execute function recalc_order_total();

-- stamp tasks.completed_at when status transitions to 'done'
create or replace function stamp_task_completed()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

create trigger trg_tasks_complete before update on tasks
  for each row execute function stamp_task_completed();

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- tenant + owner profile bootstrap, called right after supabase.auth signup
create or replace function create_tenant_for_current_user(
  p_name text,
  p_phone text default null,
  p_address text default null,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Already belongs to a shop';
  end if;

  insert into tenants (name, phone, address, currency)
  values (p_name, p_phone, p_address, p_currency)
  returning id into new_tenant_id;

  insert into profiles (id, tenant_id, full_name, email, role)
  values (
    auth.uid(),
    new_tenant_id,
    coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = auth.uid()), ''),
    (select email from auth.users where id = auth.uid()),
    'owner'
  );

  update tenants set owner_id = auth.uid() where id = new_tenant_id;

  return new_tenant_id;
end;
$$;

-- race-safe per-tenant order numbering (ORD-0001, ORD-0002, ...)
create table tenant_order_seq (
  tenant_id   uuid primary key references tenants(id) on delete cascade,
  next_number bigint not null default 1
);

create or replace function generate_order_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  insert into tenant_order_seq (tenant_id, next_number)
  values (p_tenant_id, 2)
  on conflict (tenant_id) do update set next_number = tenant_order_seq.next_number + 1
  returning next_number - 1 into n;

  return 'ORD-' || lpad(n::text, 4, '0');
end;
$$;

-- atomically creates an order + its items so total_amount (trigger-computed)
-- always reflects every item, never a partial set
create or replace function create_order_with_items(
  p_customer_id uuid,
  p_due_date date,
  p_notes text,
  p_items jsonb   -- array of {description, garmentType, fabric, quantity, unitPrice, notes}
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

-- server-side status transition, mirrors Convex's ALLOWED_TRANSITIONS map
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

-- records a customer payment, guarding against overpayment
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

-- records a worker payment against an order (job costing), enforcing the
-- order reference server-side rather than only in the UI
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

-- writes this tenant's Fincra credentials (owner-only); secrets are never
-- readable back through this or any other client-facing function
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

-- client-safe read of this tenant's Fincra connection: never returns
-- secret_key or webhook_secret
create or replace function get_fincra_settings_public()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'businessId', business_id,
    'publicKey', public_key,
    'isLive', is_live,
    'connected', true
  )
  from fincra_settings
  where tenant_id = current_tenant_id();
$$;

-- ----------------------------------------------------------------------------
-- SUBSCRIPTION BILLING (shop -> platform, via the platform's own Fincra
-- account — see supabase/functions/subscription-billing). Distinct from
-- fincra_settings/set_fincra_settings above, which is each shop's own
-- Fincra account for taking payments from ITS customers.
-- ----------------------------------------------------------------------------

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

  -- No default plan here: with more than one active plan, guessing "first
  -- by code" would silently misreport what a trialing shop will pay. `plan`
  -- stays null until the shop has actually chosen or paid for one.
  if v_tenant.plan_code is not null then
    select jsonb_build_object(
      'code', p.code,
      'name', p.name,
      'amount', p.amount,
      'currency', p.currency,
      'intervalDays', p.interval_days
    )
    into v_plan
    from plans p
    where p.code = v_tenant.plan_code;
  else
    v_plan := null;
  end if;

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

-- Called only by supabase/functions/subscription-billing's webhook handler
-- via the service-role key — revoked from PUBLIC below so no tenant can
-- call this through the client SDK and grant itself a free active
-- subscription. Idempotent on `reference`; extends from the later of "now"
-- or the existing current_period_end so an early renewal adds on top of
-- remaining time instead of discarding it.
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

-- ============================================================================
-- ANALYTICS (read-only, RLS-scoped via current_tenant_id())
-- ============================================================================

create or replace function get_dashboard_stats()
returns jsonb
language plpgsql
stable
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_order_counts jsonb;
  v_total_orders int;
  v_revenue_this_month numeric;
  v_total_collected numeric;
  v_total_billed numeric;
  v_total_outstanding numeric;
  v_active_workers int;
  v_tasks_done int;
  v_tasks_pending int;
  v_tasks_in_progress int;
begin
  select jsonb_build_object(
    'received', count(*) filter (where status = 'received'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'completed', count(*) filter (where status = 'completed'),
    'delivered', count(*) filter (where status = 'delivered')
  ), count(*), coalesce(sum(total_amount), 0)
  into v_order_counts, v_total_orders, v_total_billed
  from orders where tenant_id = v_tenant_id;

  select coalesce(sum(amount), 0) into v_total_collected
  from payments where tenant_id = v_tenant_id;

  select coalesce(sum(amount), 0) into v_revenue_this_month
  from payments
  where tenant_id = v_tenant_id
    and paid_at >= date_trunc('month', now())
    and paid_at < date_trunc('month', now()) + interval '1 month';

  v_total_outstanding := greatest(0, v_total_billed - v_total_collected);

  select count(*) filter (where is_active) into v_active_workers
  from workers where tenant_id = v_tenant_id;

  select
    count(*) filter (where status = 'done'),
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'in_progress')
  into v_tasks_done, v_tasks_pending, v_tasks_in_progress
  from tasks where tenant_id = v_tenant_id;

  return jsonb_build_object(
    'orderCounts', v_order_counts,
    'totalOrders', v_total_orders,
    'revenueThisMonth', v_revenue_this_month,
    'totalCollected', v_total_collected,
    'totalBilled', v_total_billed,
    'totalOutstanding', v_total_outstanding,
    'activeWorkers', v_active_workers,
    'tasksDone', v_tasks_done,
    'tasksPending', v_tasks_pending,
    'tasksInProgress', v_tasks_in_progress
  );
end;
$$;

create or replace function get_revenue_by_month()
returns jsonb
language plpgsql
stable
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_result jsonb := '[]'::jsonb;
  v_month date;
  v_label text;
  v_billed numeric;
  v_collected numeric;
  i int;
begin
  for i in reverse 5..0 loop
    v_month := date_trunc('month', now() - (i || ' months')::interval)::date;
    v_label := to_char(v_month, 'Mon YY');

    select coalesce(sum(amount), 0) into v_collected
    from payments
    where tenant_id = v_tenant_id
      and paid_at >= v_month and paid_at < v_month + interval '1 month';

    select coalesce(sum(total_amount), 0) into v_billed
    from orders
    where tenant_id = v_tenant_id
      and created_at >= v_month and created_at < v_month + interval '1 month';

    v_result := v_result || jsonb_build_object(
      'key', v_month, 'label', v_label, 'billed', v_billed, 'collected', v_collected
    );
  end loop;

  return v_result;
end;
$$;

create or replace function get_top_customers()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', c.name, 'total', t.total, 'orderCount', t.order_count
  )), '[]'::jsonb)
  from (
    select customer_id, sum(total_amount) as total, count(*) as order_count
    from orders
    where tenant_id = current_tenant_id()
    group by customer_id
    order by sum(total_amount) desc
    limit 5
  ) t
  join customers c on c.id = t.customer_id;
$$;

create or replace function get_worker_performance()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', w.name,
    'specialization', w.specialization,
    'isActive', w.is_active,
    'done', coalesce(tc.done, 0),
    'pending', coalesce(tc.pending, 0),
    'inProgress', coalesce(tc.in_progress, 0),
    'totalTasks', coalesce(tc.total, 0),
    'taskEarnings', coalesce(tc.task_earnings, 0),
    'payoutTotal', coalesce(p.payout_total, 0)
  )), '[]'::jsonb)
  from workers w
  left join (
    select
      worker_id,
      count(*) filter (where status = 'done') as done,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'in_progress') as in_progress,
      count(*) as total,
      sum(payout) filter (where status = 'done') as task_earnings
    from tasks
    where tenant_id = current_tenant_id()
    group by worker_id
  ) tc on tc.worker_id = w.id
  left join (
    select worker_id, sum(amount) as payout_total
    from worker_payouts
    where tenant_id = current_tenant_id()
    group by worker_id
  ) p on p.worker_id = w.id
  where w.tenant_id = current_tenant_id();
$$;

-- ----------------------------------------------------------------------------
-- PLATFORM ADMIN DASHBOARD METRICS
-- security definer + explicit is_platform_admin() check (mirrors the
-- ownership check in set_fincra_settings()) — this function bypasses RLS
-- entirely, same as every other security-definer function in this schema,
-- so the admin gate below is the only thing standing between it and every
-- tenant's data.
--
-- Revenue is grouped by tenant currency rather than summed into one number:
-- tenants.currency varies per shop, so adding raw amounts across currencies
-- would silently blend unrelated units.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- ADMIN ACCESS LOG
-- Append-only audit trail for every platform-admin read below. No
-- client-facing policies: only log_admin_access() (security definer) ever
-- writes to it, and nothing reads it back through the client yet — a future
-- "admin activity" view would get its own audited RPC, matching the pattern
-- established here, rather than a raw select policy.
-- ----------------------------------------------------------------------------
create table admin_access_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid not null references platform_admins(id) on delete cascade,
  action      text not null,
  detail      text,
  row_count   int not null default 0,
  created_at  timestamptz not null default now()
);
create index admin_access_log_admin_idx on admin_access_log(admin_id, created_at desc);

create or replace function log_admin_access(p_action text, p_detail text, p_row_count int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into admin_access_log (admin_id, action, detail, row_count)
  values (auth.uid(), p_action, p_detail, p_row_count);
$$;

-- ----------------------------------------------------------------------------
-- PLATFORM ADMIN READS
-- Every admin list/search view reads through one of these — security
-- definer (bypasses RLS, so no `_admin_select` policy is needed on the
-- underlying tables at all), gated by is_platform_admin(), and logged via
-- log_admin_access(). Each returns exactly what its page displays; the
-- Clients page's whole purpose is showing phone/email/measurements, so
-- those aren't stripped, but every read of them is now impossible to reach
-- except through one checked, audited function.
-- ----------------------------------------------------------------------------
create or replace function admin_list_clients(p_search text, p_limit int, p_offset int)
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
    'id', c.id,
    'tenantId', c.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'name', c.name,
    'phone', c.phone,
    'email', c.email,
    'measurements', c.measurements
  ) order by c.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select * from customers
    where p_search is null or p_search = '' or name ilike '%' || p_search || '%'
    order by created_at desc
    offset p_offset limit p_limit
  ) c
  left join tenants t on t.id = c.tenant_id;

  perform log_admin_access('list_clients', p_search, jsonb_array_length(v_result));
  return v_result;
end;
$$;

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

create or replace function admin_schedule(p_range_start date, p_range_end date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fittings jsonb;
  v_deliveries jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'tenantId', f.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'customerName', coalesce(c.name, 'Unknown'),
    'scheduledAt', f.scheduled_at,
    'status', f.status,
    'notes', f.notes
  ) order by f.scheduled_at asc), '[]'::jsonb)
  into v_fittings
  from fittings f
  left join tenants t on t.id = f.tenant_id
  left join customers c on c.id = f.customer_id
  where f.scheduled_at >= p_range_start and f.scheduled_at < p_range_end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'tenantId', o.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'orderNumber', o.order_number,
    'customerName', coalesce(c.name, 'Unknown'),
    'dueDate', o.due_date,
    'status', o.status
  ) order by o.due_date asc), '[]'::jsonb)
  into v_deliveries
  from orders o
  left join tenants t on t.id = o.tenant_id
  left join customers c on c.id = o.customer_id
  where o.due_date >= p_range_start and o.due_date < p_range_end;

  perform log_admin_access(
    'schedule',
    p_range_start::text || '..' || p_range_end::text,
    jsonb_array_length(v_fittings) + jsonb_array_length(v_deliveries)
  );

  return jsonb_build_object('fittings', v_fittings, 'deliveries', v_deliveries);
end;
$$;

create or replace function admin_list_inventory(p_search text, p_limit int, p_offset int)
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
    'id', i.id,
    'tenantId', i.tenant_id,
    'tenantName', coalesce(t.name, 'Unknown shop'),
    'name', i.name,
    'category', i.category,
    'unit', i.unit,
    'quantityOnHand', i.quantity_on_hand,
    'reorderThreshold', i.reorder_threshold
  ) order by i.quantity_on_hand asc), '[]'::jsonb)
  into v_result
  from (
    select * from inventory_items
    where p_search is null or p_search = '' or name ilike '%' || p_search || '%'
    order by quantity_on_hand asc
    offset p_offset limit p_limit
  ) i
  left join tenants t on t.id = i.tenant_id;

  perform log_admin_access('list_inventory', p_search, jsonb_array_length(v_result));
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

-- ----------------------------------------------------------------------------
-- SHOPS (subscription visibility + manual override)
-- The manual-renewal billing model guarantees occasional human intervention
-- (a shop pays by bank transfer, a payment needs comping) — this is that
-- escape hatch, audited the same as every other admin action.
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
  p_period_end timestamptz,
  p_plan_code text default null
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

  if p_plan_code is not null and not exists (select 1 from plans where code = p_plan_code) then
    raise exception 'Unknown plan code: %', p_plan_code;
  end if;

  update tenants
  set subscription_status = p_status,
      current_period_end = p_period_end,
      plan_code = coalesce(p_plan_code, plan_code)
  where id = p_tenant_id;

  if not found then
    raise exception 'Shop not found';
  end if;

  perform log_admin_access(
    'set_tenant_subscription',
    p_tenant_id::text || ' -> ' || p_status ||
      case when p_plan_code is not null then ' (' || p_plan_code || ')' else '' end,
    1
  );
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table tenants           enable row level security;
alter table profiles          enable row level security;
alter table customers         enable row level security;
alter table workers           enable row level security;
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table order_materials   enable row level security;
alter table tasks             enable row level security;
alter table payments          enable row level security;
alter table worker_payouts    enable row level security;
alter table tenant_order_seq  enable row level security;
-- no policies on tenant_order_seq: only ever touched by the
-- security definer generate_order_number(), never directly by clients
alter table fincra_settings   enable row level security;
-- no policies on fincra_settings either: secrets are only ever written via
-- set_fincra_settings() and read (non-secret fields only) via
-- get_fincra_settings_public(), or by the fincra-checkout edge function
-- using the service-role key, which bypasses RLS entirely
alter table inventory_items   enable row level security;
alter table fittings          enable row level security;
alter table platform_admins   enable row level security;
alter table admin_access_log  enable row level security;
-- no policies on platform_admins: only is_platform_admin() and
-- get_platform_admin_dashboard_stats() (both security definer) read it
alter table plans                 enable row level security;
alter table subscription_invoices enable row level security;

create policy tenants_select on tenants
  for select using (id = current_tenant_id());
create policy tenants_update on tenants
  for update using (id = current_tenant_id() and current_user_role() = 'owner');

create policy profiles_select on profiles
  for select using (tenant_id = current_tenant_id());
create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- Every tenant-scoped business table below gets four policies instead of
-- one blanket `for all`: SELECT is never gated (the 30-day-trial/subscription
-- gate is a "read-only lock", not "hide their data" — see tenant_can_write()
-- above), while INSERT/UPDATE/DELETE additionally require tenant_can_write().
-- Written as a loop so the pattern can't drift table to table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'workers', 'orders', 'order_items', 'order_materials',
    'tasks', 'payments', 'worker_payouts', 'inventory_items', 'fittings'
  ]
  loop
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

create policy plans_select on plans
  for select using (auth.uid() is not null);

create policy subscription_invoices_select on subscription_invoices
  for select using (tenant_id = current_tenant_id());
-- no insert/update/delete policy on subscription_invoices: only
-- apply_subscription_payment() (service-role only, see above) ever writes here

-- Platform-admin reads do NOT get a raw RLS select policy here — every one
-- of them is a purpose-built, audited, security-definer RPC instead (see
-- ADMIN ACCESS LOG / admin_list_*/admin_schedule/admin_quick_search below),
-- so nothing with an authenticated client can read across tenants except
-- through those checked, logged functions. See
-- supabase/migrations/0005_admin_audit_scoped_access.sql for why this
-- replaced an earlier, broader set of `_admin_select` policies.
