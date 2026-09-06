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
create type payment_method as enum ('cash', 'bank_transfer', 'card', 'other');

-- ----------------------------------------------------------------------------
-- TENANTS  (one row per tailoring business)
-- ----------------------------------------------------------------------------
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  currency    text not null default 'USD',
  owner_id    uuid,                      -- set after the owner profile is created
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
  created_at    timestamptz not null default now()
);
create index order_items_order_idx on order_items(order_id);
create index order_items_tenant_idx on order_items(tenant_id);

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
  paid_at       timestamptz not null default now()
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
  amount      numeric(12,2) not null check (amount > 0),
  notes       text,
  paid_at     timestamptz not null default now()
);
create index worker_payouts_tenant_idx on worker_payouts(tenant_id);
create index worker_payouts_worker_idx on worker_payouts(worker_id);

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

  if not exists (select 1 from customers where id = p_customer_id and tenant_id = v_tenant_id) then
    raise exception 'Customer not found';
  end if;

  insert into orders (tenant_id, customer_id, order_number, status, due_date, notes)
  values (v_tenant_id, p_customer_id, generate_order_number(v_tenant_id), 'received', p_due_date, p_notes)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items (tenant_id, order_id, description, garment_type, fabric, quantity, unit_price, notes)
    values (
      v_tenant_id,
      v_order_id,
      v_item->>'description',
      nullif(v_item->>'garmentType', ''),
      nullif(v_item->>'fabric', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce((v_item->>'unitPrice')::numeric, 0),
      nullif(v_item->>'notes', '')
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

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table tenants           enable row level security;
alter table profiles          enable row level security;
alter table customers         enable row level security;
alter table workers           enable row level security;
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table tasks             enable row level security;
alter table payments          enable row level security;
alter table worker_payouts    enable row level security;
alter table tenant_order_seq  enable row level security;
-- no policies on tenant_order_seq: only ever touched by the
-- security definer generate_order_number(), never directly by clients

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

create policy customers_all on customers
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy workers_all on workers
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy orders_all on orders
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy order_items_all on order_items
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy tasks_all on tasks
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy payments_all on payments
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy worker_payouts_all on worker_payouts
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
