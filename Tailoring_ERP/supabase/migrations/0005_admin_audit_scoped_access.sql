-- ============================================================================
-- Close the platform-admin blast radius opened by 0004_platform_admin.sql.
--
-- 0004 gave any platform_admins row unrestricted, unaudited SELECT on every
-- tenant's customers (incl. body measurements, phone, email), orders,
-- workers, tasks, payments, tenants, inventory_items and fittings via nine
-- `_admin_select` RLS policies — reachable directly through the client SDK,
-- not just through the admin dashboard's own queries. That's a far bigger
-- exposure than "aggregate stats + a few list views" needs, with no way to
-- tell afterwards which admin looked at which tenant's data.
--
-- This migration replaces every one of those raw policies with a
-- purpose-built, audited, security-definer RPC per admin read — the same
-- pattern get_platform_admin_dashboard_stats() already used correctly.
-- Each function still returns exactly what its page displays (the Clients
-- page's whole job is showing phone/email/measurements, so those aren't
-- stripped), but now every read is (a) impossible to reach except through
-- that one checked function, since RLS no longer grants raw table access at
-- all, and (b) logged to admin_access_log with who, what, and how many rows.
-- Run this once in the Supabase SQL Editor (after 0001-0004).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Drop the blanket read grants from 0004 — nothing needs them once every
-- admin read goes through a security-definer function below (which bypasses
-- RLS entirely, same as every other security-definer function in this
-- schema, so it never needed the RLS policy to begin with).
-- ----------------------------------------------------------------------------
drop policy if exists tenants_admin_select on tenants;
drop policy if exists customers_admin_select on customers;
drop policy if exists orders_admin_select on orders;
drop policy if exists order_items_admin_select on order_items;
drop policy if exists workers_admin_select on workers;
drop policy if exists tasks_admin_select on tasks;
drop policy if exists payments_admin_select on payments;
drop policy if exists inventory_items_admin_select on inventory_items;
drop policy if exists fittings_admin_select on fittings;

-- ----------------------------------------------------------------------------
-- ADMIN ACCESS LOG
-- Append-only audit trail. No client-facing policies: only
-- log_admin_access() (security definer, below) ever writes to it, and
-- nothing reads it back through the client yet — a future "admin activity"
-- view would get its own audited RPC, matching the pattern this migration
-- establishes for every other admin-facing read, rather than a raw select
-- policy.
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

alter table admin_access_log enable row level security;

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
-- CLIENTS
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

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- SCHEDULE (fittings + deliveries for a date range)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- INVENTORY
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- STAFF
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUICK SEARCH (header search: orders + clients)
-- ----------------------------------------------------------------------------
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
    limit 5
  ) c
  left join tenants t on t.id = c.tenant_id;

  v_result := v_orders || v_clients;
  perform log_admin_access('quick_search', p_term, jsonb_array_length(v_result));
  return v_result;
end;
$$;
