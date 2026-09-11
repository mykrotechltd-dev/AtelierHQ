-- ============================================================================
-- Platform-level admin area for the SaaS operator (mykrotech), separate from
-- every tenant's own login and data. A platform admin is NOT a tenant user —
-- platform_admins has no tenant_id and is never granted through the tenant
-- signup/onboarding flow. Run this once in the Supabase SQL Editor (after
-- 0001, 0002, 0003).
--
-- Two new tables also ship here because the admin dashboard's "Pending
-- Fittings" and "Low Inventory" cards need a data source that doesn't exist
-- yet anywhere in this schema — order_materials is a per-order bill of
-- materials, not shop-wide stock, and there was no appointments table at
-- all. inventory_items/fittings are tenant-scoped exactly like every other
-- business table (RLS via current_tenant_id()); nothing in this migration
-- adds tenant-facing UI to write to them, so on a fresh install they will
-- read empty until a follow-up ships that UI or the shop seeds rows itself.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PLATFORM ADMINS
-- ----------------------------------------------------------------------------
create table platform_admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

alter table platform_admins enable row level security;
-- no client-facing policies: only is_platform_admin() (below) and
-- get_platform_admin_dashboard_stats() ever read this table, both
-- security definer, so no anon/authenticated role can select it directly

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from platform_admins where id = auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- INVENTORY ITEMS  (shop-wide raw material stock, distinct from
-- order_materials' per-order bill of materials)
-- ----------------------------------------------------------------------------
create type inventory_category as enum ('fabric', 'thread', 'button', 'other');

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

create trigger trg_inventory_items_updated_at before update on inventory_items
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- FITTINGS  (fitting appointments; separate from orders.due_date, which is
-- the delivery date)
-- ----------------------------------------------------------------------------
create type fitting_status as enum ('scheduled', 'completed', 'cancelled');

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

alter table inventory_items enable row level security;
alter table fittings        enable row level security;

create policy inventory_items_all on inventory_items
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy fittings_all on fittings
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- ----------------------------------------------------------------------------
-- PLATFORM-ADMIN READ ACCESS
-- Additive, read-only permissive policies — these sit alongside each
-- table's existing tenant-scoped policy (Postgres OR's permissive policies
-- together), so tenant isolation for normal tenant sessions is unchanged.
-- Only a session whose auth.uid() is in platform_admins gains anything here.
-- ----------------------------------------------------------------------------
create policy tenants_admin_select on tenants
  for select using (is_platform_admin());
create policy customers_admin_select on customers
  for select using (is_platform_admin());
create policy orders_admin_select on orders
  for select using (is_platform_admin());
create policy order_items_admin_select on order_items
  for select using (is_platform_admin());
create policy workers_admin_select on workers
  for select using (is_platform_admin());
create policy tasks_admin_select on tasks
  for select using (is_platform_admin());
create policy payments_admin_select on payments
  for select using (is_platform_admin());
create policy inventory_items_admin_select on inventory_items
  for select using (is_platform_admin());
create policy fittings_admin_select on fittings
  for select using (is_platform_admin());

-- ----------------------------------------------------------------------------
-- DASHBOARD METRICS
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

  return jsonb_build_object(
    'revenueByCurrency', v_revenue,
    'activeOrders', v_active_orders,
    'fittingsToday', v_fittings_today,
    'fittingsThisWeek', v_fittings_week,
    'lowInventoryCount', v_low_inventory
  );
end;
$$;
