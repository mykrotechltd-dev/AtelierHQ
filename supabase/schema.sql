-- ============================================================================
-- AtelierHQ — multi-tenant schema for Supabase (Postgres)
-- Tenant isolation strategy: single shared schema, every business table carries
-- a tenant_id, and Row Level Security enforces that a session can only ever
-- read/write rows belonging to its own tenant. This scales to many tailoring
-- shops on one Supabase project without per-tenant databases.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy customer/order search

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type user_role        as enum ('owner', 'admin', 'staff', 'worker');
create type order_status     as enum ('received', 'in_progress', 'completed', 'delivered', 'cancelled');
create type task_type        as enum ('cutting', 'stitching', 'embroidery', 'hand_work', 'finishing', 'alteration');
create type task_status      as enum ('pending', 'assigned', 'in_progress', 'done', 'blocked');
create type payment_method   as enum ('cash', 'card', 'bank_transfer', 'mobile_money', 'other');
create type payment_direction as enum ('customer_payment', 'worker_payout');
create type invoice_status   as enum ('draft', 'issued', 'paid', 'void');
create type notification_channel as enum ('whatsapp', 'sms', 'email');
create type notification_status as enum ('queued', 'sent', 'failed');
create type subscription_plan as enum ('trial', 'starter', 'pro', 'business');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- ----------------------------------------------------------------------------
-- TENANTS  (one row per tailoring business)
-- ----------------------------------------------------------------------------
create table tenants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique not null,
  phone               text,
  whatsapp_number     text,
  address             text,
  currency            text not null default 'NGN',
  logo_url            text,
  owner_id            uuid,                       -- set after first profile is created
  plan                subscription_plan not null default 'trial',
  subscription_status subscription_status not null default 'trialing',
  trial_ends_at       timestamptz not null default (now() + interval '14 days'),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PROFILES  (extends auth.users; every staff/owner/worker login has one)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        user_role not null default 'staff',
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index profiles_tenant_idx on profiles(tenant_id);

alter table tenants add constraint tenants_owner_fk
  foreign key (owner_id) references profiles(id) deferrable initially deferred;

-- ----------------------------------------------------------------------------
-- helper: resolve the caller's tenant + role without recursive RLS lookups
-- SECURITY DEFINER so it can read `profiles` even though profiles itself is
-- RLS-protected; this is the single source of truth every policy calls.
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

create or replace function is_staff_or_above()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select current_user_role() in ('owner', 'admin', 'staff');
$$;

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  whatsapp_number text,
  email       text,
  address     text,
  notes       text,
  tags        text[] not null default '{}',
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index customers_tenant_idx on customers(tenant_id);
create index customers_search_idx on customers using gin (full_name gin_trgm_ops, phone gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- MEASUREMENTS
-- One customer can have several garment-type measurement profiles
-- (shirt, trouser, agbada, blouse, suit ...). Fields are a flexible jsonb map
-- (e.g. {"chest": 40, "waist": 34, "shoulder": 18, "sleeve_length": 24})
-- so the schema doesn't need to change per garment type or region.
-- ----------------------------------------------------------------------------
create table measurements (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  garment_type  text not null,                 -- 'shirt' | 'trouser' | 'agbada' | 'suit' | ...
  label         text,                          -- e.g. "Wedding suit 2026"
  values        jsonb not null default '{}',   -- unit-agnostic measurement key/values
  unit          text not null default 'in',    -- 'in' | 'cm'
  recorded_by   uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index measurements_tenant_idx on measurements(tenant_id);
create index measurements_customer_idx on measurements(customer_id);

-- ----------------------------------------------------------------------------
-- WORKERS  (tailors/artisans who perform tasks — may or may not have a login)
-- ----------------------------------------------------------------------------
create table workers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  profile_id      uuid references profiles(id) on delete set null, -- null if they don't log in
  full_name       text not null,
  phone           text,
  specialties     task_type[] not null default '{}',
  pay_rate_type   text not null default 'per_task' check (pay_rate_type in ('per_task','hourly','salary')),
  pay_rate        numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index workers_tenant_idx on workers(tenant_id);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
create table orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  order_number    text not null,               -- human-friendly, per-tenant sequential (e.g. ORD-0001)
  customer_id     uuid not null references customers(id),
  status          order_status not null default 'received',
  due_date        date,
  delivered_at    timestamptz,
  total_amount    numeric(12,2) not null default 0,   -- denormalized sum of order_items, kept in sync by trigger
  amount_paid     numeric(12,2) not null default 0,   -- denormalized sum of payments, kept in sync by trigger
  discount        numeric(12,2) not null default 0,
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, order_number)
);
create index orders_tenant_idx on orders(tenant_id);
create index orders_customer_idx on orders(customer_id);
create index orders_status_idx on orders(tenant_id, status);
create index orders_due_date_idx on orders(tenant_id, due_date);

-- balance_due is derived, not stored, to avoid drift
create or replace view orders_with_balance as
  select o.*, (o.total_amount - o.discount - o.amount_paid) as balance_due
  from orders o;

-- ----------------------------------------------------------------------------
-- ORDER ITEMS  (multiple garments per order)
-- ----------------------------------------------------------------------------
create table order_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  garment_type    text not null,
  description     text,
  quantity        integer not null default 1 check (quantity > 0),
  unit_price      numeric(12,2) not null default 0,
  measurement_id  uuid references measurements(id),   -- snapshot reference at time of order
  fabric_notes    text,
  status          order_status not null default 'received', -- item can lag/lead the parent order
  created_at      timestamptz not null default now()
);
create index order_items_tenant_idx on order_items(tenant_id);
create index order_items_order_idx on order_items(order_id);

-- ----------------------------------------------------------------------------
-- TASKS  (cutting / embroidery / hand work / stitching, assigned to workers)
-- ----------------------------------------------------------------------------
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  order_item_id   uuid references order_items(id) on delete cascade,
  task_type       task_type not null,
  assigned_to     uuid references workers(id),
  status          task_status not null default 'pending',
  due_date        date,
  started_at      timestamptz,
  completed_at    timestamptz,
  pay_amount      numeric(12,2) not null default 0,   -- what the worker earns for this task
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_tenant_idx on tasks(tenant_id);
create index tasks_order_idx on tasks(order_id);
create index tasks_assignee_idx on tasks(assigned_to, status);

-- ----------------------------------------------------------------------------
-- PAYMENTS  (both customer payments toward an order and worker payouts)
-- ----------------------------------------------------------------------------
create table payments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  direction       payment_direction not null default 'customer_payment',
  order_id        uuid references orders(id) on delete set null,
  worker_id       uuid references workers(id) on delete set null,
  amount          numeric(12,2) not null check (amount > 0),
  method          payment_method not null default 'cash',
  reference       text,
  recorded_by     uuid references profiles(id),
  paid_at         timestamptz not null default now(),
  notes           text
);
create index payments_tenant_idx on payments(tenant_id);
create index payments_order_idx on payments(order_id);
create index payments_worker_idx on payments(worker_id);
create index payments_paid_at_idx on payments(tenant_id, paid_at);

-- ----------------------------------------------------------------------------
-- INVOICES  (generated PDF records)
-- ----------------------------------------------------------------------------
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  invoice_number  text not null,
  status          invoice_status not null default 'issued',
  pdf_path        text,                 -- path inside the private `invoices` storage bucket
  total_amount    numeric(12,2) not null,
  issued_at       timestamptz not null default now(),
  issued_by       uuid references profiles(id),
  unique (tenant_id, invoice_number)
);
create index invoices_tenant_idx on invoices(tenant_id);
create index invoices_order_idx on invoices(order_id);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS  (WhatsApp / SMS / email queue + delivery log)
-- ----------------------------------------------------------------------------
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  customer_id     uuid references customers(id),
  channel         notification_channel not null,
  template        text not null,        -- 'order_received' | 'order_ready' | 'invoice' | 'payment_reminder' ...
  payload         jsonb not null default '{}',
  status          notification_status not null default 'queued',
  error           text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_tenant_idx on notifications(tenant_id);
create index notifications_status_idx on notifications(status) where status = 'queued';

-- ----------------------------------------------------------------------------
-- AUDIT LOGS  (append-only; who changed what)
-- ----------------------------------------------------------------------------
create table audit_logs (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  actor_id      uuid references profiles(id),
  action        text not null,          -- 'order.status_changed', 'payment.recorded', ...
  entity_table  text not null,
  entity_id     uuid,
  diff          jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_tenant_idx on audit_logs(tenant_id, created_at desc);

-- ============================================================================
-- TRIGGERS — keep denormalized totals correct, stamp updated_at, write audits
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger trg_measurements_updated_at before update on measurements
  for each row execute function set_updated_at();
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger trg_tenants_updated_at before update on tenants
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

-- recompute orders.amount_paid whenever a customer payment changes
create or replace function recalc_order_paid()
returns trigger language plpgsql as $$
declare
  target_order uuid := coalesce(new.order_id, old.order_id);
begin
  if target_order is null then
    return null;
  end if;
  update orders
    set amount_paid = coalesce((
      select sum(amount) from payments
      where order_id = target_order and direction = 'customer_payment'
    ), 0)
    where id = target_order;
  return null;
end;
$$;

create trigger trg_payments_recalc
  after insert or update or delete on payments
  for each row execute function recalc_order_paid();

-- generic audit trigger for orders (status changes are the highest-value audit trail)
create or replace function audit_order_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into audit_logs (tenant_id, actor_id, action, entity_table, entity_id, diff)
    values (
      new.tenant_id, auth.uid(), 'order.status_changed', 'orders', new.id,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger trg_orders_audit
  after update on orders
  for each row execute function audit_order_status_change();

-- ----------------------------------------------------------------------------
-- per-tenant order numbering (ORD-0001, ORD-0002, ...), race-safe via
-- upsert + returning so two staff creating orders at once never collide
-- ----------------------------------------------------------------------------
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

-- atomically creates an order + its items in one round trip so the order
-- total (recomputed by trigger) always reflects every item, never a partial set
create or replace function create_order_with_items(
  p_customer_id uuid,
  p_due_date date,
  p_discount numeric,
  p_notes text,
  p_items jsonb   -- array of {garment_type, description, quantity, unit_price, measurement_id, fabric_notes}
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
    raise exception 'No tenant context for current user';
  end if;

  if not is_staff_or_above() then
    raise exception 'Insufficient role to create orders';
  end if;

  insert into orders (tenant_id, order_number, customer_id, due_date, discount, notes, created_by)
  values (v_tenant_id, generate_order_number(v_tenant_id), p_customer_id, p_due_date, coalesce(p_discount, 0), p_notes, auth.uid())
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items (tenant_id, order_id, garment_type, description, quantity, unit_price, measurement_id, fabric_notes)
    values (
      v_tenant_id,
      v_order_id,
      v_item->>'garment_type',
      nullif(v_item->>'description', ''),
      coalesce((v_item->>'quantity')::int, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      nullif(v_item->>'measurement_id', '')::uuid,
      nullif(v_item->>'fabric_notes', '')
    );
  end loop;

  return v_order_id;
end;
$$;

-- tenant + owner profile bootstrap, called from the app right after auth.signUp()
create or replace function create_tenant_for_current_user(
  business_name text,
  owner_full_name text,
  business_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  base_slug := lower(regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g'));
  final_slug := base_slug;
  while exists (select 1 from tenants where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into tenants (name, slug, phone)
  values (business_name, final_slug, business_phone)
  returning id into new_tenant_id;

  insert into profiles (id, tenant_id, full_name, role)
  values (auth.uid(), new_tenant_id, owner_full_name, 'owner');

  update tenants set owner_id = auth.uid() where id = new_tenant_id;

  return new_tenant_id;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table tenants        enable row level security;
alter table profiles       enable row level security;
alter table customers      enable row level security;
alter table measurements   enable row level security;
alter table workers        enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table tasks          enable row level security;
alter table payments       enable row level security;
alter table invoices       enable row level security;
alter table notifications  enable row level security;
alter table audit_logs     enable row level security;
alter table tenant_order_seq enable row level security;
-- no policies on tenant_order_seq: it is only ever touched by the
-- SECURITY DEFINER generate_order_number() function, never directly by clients

-- tenants: a user can see only their own tenant; only owner/admin can update it
create policy tenants_select on tenants
  for select using (id = current_tenant_id());
create policy tenants_update on tenants
  for update using (id = current_tenant_id() and current_user_role() in ('owner','admin'));

-- profiles: visible within the same tenant; a user may update their own row,
-- owner/admin may update anyone's role within the tenant
create policy profiles_select on profiles
  for select using (tenant_id = current_tenant_id());
create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());
create policy profiles_update on profiles
  for update using (
    tenant_id = current_tenant_id()
    and (id = auth.uid() or current_user_role() in ('owner','admin'))
  );

-- generic tenant-scoped CRUD template applied to every business table:
-- SELECT/INSERT/UPDATE/DELETE all require tenant_id = current_tenant_id().
-- Mutations additionally require staff-or-above (workers with a login are
-- read-mostly: they can see and update their own assigned tasks, handled
-- by a dedicated policy below).

create policy customers_all on customers
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());
create policy customers_select on customers
  for select using (tenant_id = current_tenant_id());

create policy measurements_all on measurements
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());

create policy workers_all on workers
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and current_user_role() in ('owner','admin'));
create policy workers_select on workers
  for select using (tenant_id = current_tenant_id());

create policy orders_all on orders
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());
create policy orders_select on orders
  for select using (tenant_id = current_tenant_id());

create policy order_items_all on order_items
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());

create policy invoices_all on invoices
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());

create policy notifications_all on notifications
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy audit_logs_select on audit_logs
  for select using (tenant_id = current_tenant_id() and current_user_role() in ('owner','admin'));

-- tasks: staff/admin/owner get full access; a worker with a profile_id can
-- see and update only tasks assigned to them (e.g. mark "in_progress"/"done"
-- from a shared shop tablet or their own phone)
create policy tasks_staff_all on tasks
  for all using (tenant_id = current_tenant_id() and is_staff_or_above())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());
create policy tasks_worker_select on tasks
  for select using (
    tenant_id = current_tenant_id()
    and assigned_to in (select id from workers where profile_id = auth.uid())
  );
create policy tasks_worker_update on tasks
  for update using (
    tenant_id = current_tenant_id()
    and assigned_to in (select id from workers where profile_id = auth.uid())
  )
  with check (
    tenant_id = current_tenant_id()
    and assigned_to in (select id from workers where profile_id = auth.uid())
  );

-- payments: customer payments are staff+; worker payout records are visible
-- to the worker they belong to as well as staff+
create policy payments_staff_all on payments
  for all using (tenant_id = current_tenant_id() and is_staff_or_above())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());
create policy payments_worker_select on payments
  for select using (
    tenant_id = current_tenant_id()
    and direction = 'worker_payout'
    and worker_id in (select id from workers where profile_id = auth.uid())
  );

-- ============================================================================
-- REPORTING VIEWS (used by /reports and the dashboard)
-- ============================================================================

create or replace view report_daily as
  select
    tenant_id,
    date_trunc('day', created_at)::date as day,
    count(*) as orders_created,
    sum(total_amount) as gross_value
  from orders
  group by tenant_id, date_trunc('day', created_at);

create or replace view report_daily_payments as
  select
    tenant_id,
    date_trunc('day', paid_at)::date as day,
    sum(amount) filter (where direction = 'customer_payment') as collected,
    sum(amount) filter (where direction = 'worker_payout') as paid_out
  from payments
  group by tenant_id, date_trunc('day', paid_at);

create or replace view report_monthly_sales as
  select
    tenant_id,
    date_trunc('month', paid_at)::date as month,
    sum(amount) as total_collected
  from payments
  where direction = 'customer_payment'
  group by tenant_id, date_trunc('month', paid_at);

create or replace view report_orders_due as
  select o.*, (o.total_amount - o.discount - o.amount_paid) as balance_due, c.full_name as customer_name, c.phone as customer_phone
  from orders o
  join customers c on c.id = o.customer_id
  where o.status not in ('delivered', 'cancelled')
  order by o.due_date nulls last;

alter view report_daily            owner to postgres;
alter view report_daily_payments   owner to postgres;
alter view report_monthly_sales    owner to postgres;
alter view report_orders_due       owner to postgres;

-- Views inherit RLS from underlying tables only when created with
-- security_invoker; enforce that explicitly (Postgres 15+ / Supabase default).
alter view report_daily            set (security_invoker = true);
alter view report_daily_payments   set (security_invoker = true);
alter view report_monthly_sales    set (security_invoker = true);
alter view report_orders_due       set (security_invoker = true);
alter view orders_with_balance     set (security_invoker = true);

-- ============================================================================
-- STORAGE (private buckets) — create via Supabase dashboard/CLI, then apply
-- these policies against storage.objects. Bucket paths are namespaced
-- `{tenant_id}/...` so the same tenant_id() check works for files.
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('invoices', 'invoices', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

-- Object paths are namespaced `{tenant_id}/{order_id}/...`, so
-- (storage.foldername(name))[1] is the tenant_id and this policy is the
-- storage-layer equivalent of the tenant_id = current_tenant_id() checks
-- used everywhere else.
create policy invoices_tenant_rw on storage.objects
  for all using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  )
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  );

create policy attachments_tenant_rw on storage.objects
  for all using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  );

-- ============================================================================
-- PLATFORM ADMIN (cross-tenant support/analytics console at /admin)
-- ----------------------------------------------------------------------------
-- Deliberately its own thing, not just "role = owner": owners are scoped to
-- their own tenant like everyone else. Platform admin is a separate,
-- tenant-independent privilege for the people running AtelierHQ itself.
-- ============================================================================

create table platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table platform_admins enable row level security;
-- Deliberately no policies: this table is only ever read through the
-- SECURITY DEFINER is_platform_admin() function below, never via a direct
-- RLS-scoped query — so there is nothing to grant a normal tenant user access to.

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from platform_admins where user_id = auth.uid());
$$;

-- To make yourself the first platform admin, run (after signing up normally):
--   insert into platform_admins (user_id) select id from auth.users where email = 'you@example.com';

-- ============================================================================
-- INVENTORY (fabric / material stock)
-- ============================================================================

create table inventory_items (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  sku               text,
  unit              text not null default 'yards',   -- 'yards' | 'meters' | 'pieces' | 'rolls' | ...
  quantity_on_hand  numeric(12,2) not null default 0,
  reorder_threshold numeric(12,2) not null default 0,
  unit_cost         numeric(12,2) not null default 0,
  supplier          text,
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index inventory_items_tenant_idx on inventory_items(tenant_id);

create trigger trg_inventory_items_updated_at before update on inventory_items
  for each row execute function set_updated_at();

alter table inventory_items enable row level security;
create policy inventory_items_all on inventory_items
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());

-- ============================================================================
-- WORK GALLERY (photos of finished projects, stored in the `attachments` bucket)
-- ============================================================================

create table gallery_photos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  order_id      uuid references orders(id) on delete set null,
  storage_path  text not null,
  caption       text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index gallery_photos_tenant_idx on gallery_photos(tenant_id);
create index gallery_photos_order_idx on gallery_photos(order_id);

alter table gallery_photos enable row level security;
create policy gallery_photos_all on gallery_photos
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_staff_or_above());

-- ============================================================================
-- Worker performance (used by the "Worker performance" section on /reports)
-- ============================================================================

create or replace view report_worker_performance as
  select
    w.tenant_id,
    w.id as worker_id,
    w.full_name,
    count(t.id) filter (where t.status = 'done') as tasks_completed,
    count(t.id) filter (where t.status in ('assigned','in_progress')) as tasks_in_progress,
    avg(extract(epoch from (t.completed_at - t.started_at)) / 3600.0)
      filter (where t.completed_at is not null and t.started_at is not null) as avg_turnaround_hours,
    coalesce((
      select sum(p.amount) from payments p
      where p.worker_id = w.id and p.direction = 'worker_payout'
    ), 0) as total_paid_out
  from workers w
  left join tasks t on t.assigned_to = w.id
  group by w.tenant_id, w.id, w.full_name;

alter view report_worker_performance set (security_invoker = true);
