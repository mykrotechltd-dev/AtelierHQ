-- ============================================================================
-- Adds a unique constraint so a shop can't have two customer records with
-- the same phone number. Run this in the Supabase SQL Editor.
--
-- IMPORTANT: your database already has at least one duplicate ("Monica
-- lawal" appears twice), so Step 2 will FAIL until you resolve that first.
-- Follow the steps in order.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 — find every duplicate phone number in your account, and how much
-- data (orders, measurements) is attached to each duplicate row. Run this
-- first and read the results before doing anything else.
-- ----------------------------------------------------------------------------
select
  c.id,
  c.full_name,
  c.phone,
  c.created_at,
  (select count(*) from orders o where o.customer_id = c.id) as order_count,
  (select count(*) from measurements m where m.customer_id = c.id) as measurement_count
from customers c
where c.phone in (
  select phone from customers group by tenant_id, phone having count(*) > 1
)
order by c.phone, c.created_at;

-- ----------------------------------------------------------------------------
-- STEP 2 — for each duplicate pair, decide which row to KEEP (usually the
-- one with orders/measurements attached, or the earliest one) and which to
-- MERGE AWAY. Replace <KEEP_ID> and <REMOVE_ID> below with the actual ids
-- from Step 1's output, then run this block once per duplicate pair.
--
-- This re-points any orders/measurements off the row you're removing before
-- deleting it, so nothing gets orphaned or lost.
-- ----------------------------------------------------------------------------
-- update orders        set customer_id = '<KEEP_ID>' where customer_id = '<REMOVE_ID>';
-- update measurements  set customer_id = '<KEEP_ID>' where customer_id = '<REMOVE_ID>';
-- delete from customers where id = '<REMOVE_ID>';

-- ----------------------------------------------------------------------------
-- STEP 3 — once Step 1 returns zero rows (no more duplicates), add the
-- constraint that prevents this from happening again.
-- ----------------------------------------------------------------------------
-- alter table customers add constraint customers_tenant_phone_key unique (tenant_id, phone);
