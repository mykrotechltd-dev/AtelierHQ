-- ============================================================================
-- Order Ledger: bill of materials, worker payment tracking (job costing),
-- and the order-item measurement snapshot. Run this once in the Supabase
-- SQL Editor against the already-migrated database (schema.sql has also
-- been updated to include these changes for any future fresh install).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Worker payouts now link to the order they were earned on. Nullable because
-- payouts recorded before this feature existed have no order to attach to.
-- ----------------------------------------------------------------------------
alter table worker_payouts
  add column order_id uuid references orders(id);
create index worker_payouts_order_idx on worker_payouts(order_id);

-- ----------------------------------------------------------------------------
-- Bill of materials: free-text material lines per garment (order item).
-- line_total is generated, never hand-maintained.
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

alter table order_materials enable row level security;
create policy order_materials_all on order_materials
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- ----------------------------------------------------------------------------
-- Per-garment measurement snapshot, frozen at the time the item is added —
-- never re-synced from the customer's master profile afterward.
-- ----------------------------------------------------------------------------
alter table order_items
  add column measurements jsonb;

-- ----------------------------------------------------------------------------
-- create_order_with_items now also stores each item's measurement snapshot.
-- ----------------------------------------------------------------------------
create or replace function create_order_with_items(
  p_customer_id uuid,
  p_due_date date,
  p_notes text,
  p_items jsonb   -- array of {description, garmentType, fabric, quantity, unitPrice, notes, measurements}
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

-- ----------------------------------------------------------------------------
-- Records a worker payment against a specific order (job costing). Replaces
-- direct-insert into worker_payouts so the order reference is enforced
-- server-side for every new payment, not just by the UI.
-- ----------------------------------------------------------------------------
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
