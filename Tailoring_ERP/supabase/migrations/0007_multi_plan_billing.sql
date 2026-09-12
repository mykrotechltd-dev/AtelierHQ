-- ============================================================================
-- Multi-plan support. 0006 shipped get_tenant_billing_state() defaulting to
-- "whichever active plan sorts first by code" whenever a tenant had no
-- plan_code yet (i.e. any shop still on its free trial) — harmless with a
-- single 'standard' plan, but silent and wrong the moment a second plan
-- (e.g. 'pro') exists: every trialing shop's billing page would show
-- whatever plan happened to sort first alphabetically, and the checkout
-- edge function (also "first active plan") would charge everyone for it
-- regardless of what they meant to pick. This migration removes that
-- default in favor of the client sending an explicit plan code (see the
-- updated supabase/functions/subscription-billing), and returns `plan: null`
-- until a shop has actually chosen or paid for one.
-- ============================================================================

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

-- Admin override gains an optional plan change — comping a shop directly
-- onto a specific tier, not just toggling status/period.
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
