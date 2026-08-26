-- ============================================================================
-- Incremental migration for an EXISTING AtelierHQ Supabase project.
-- Run this once in the SQL Editor (do not re-run the whole schema.sql — it
-- will fail on "already exists" for everything you've already applied).
--
-- Adds:
--   - platform_admins + is_platform_admin() for the /admin console
--   - inventory_items (fabric/material stock)
--   - gallery_photos (work gallery, uses the existing `attachments` bucket)
--   - report_worker_performance view (used on /reports)
--
-- This exact block is also appended to the master supabase/schema.sql, so a
-- fresh install running that file end-to-end gets all of this too.
-- ============================================================================

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
