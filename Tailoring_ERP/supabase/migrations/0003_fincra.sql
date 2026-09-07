-- ============================================================================
-- Switch the payment gateway from Stripe to Fincra (Stripe is unavailable in
-- this shop's region). Fincra has no confirmed public API for a platform to
-- create per-tenant sub-accounts (unlike Stripe Connect's Express accounts),
-- so each tenant instead connects its OWN Fincra business account directly:
-- they sign up with Fincra themselves and paste their own credentials here.
-- The secret key and webhook secret never become client-readable — same
-- write-only-to-clients pattern as the schema originally used for Stripe's
-- secret settings, now applied to fincra_settings. Run this once in the
-- Supabase SQL Editor (after 0001 and 0002).
-- ============================================================================

-- The Stripe Connect columns are dead now — nothing was ever deployed against
-- them (the edge function never got deployed), so they're safe to drop.
alter table tenants
  drop column stripe_connect_account_id,
  drop column stripe_onboarding_status,
  drop column stripe_country,
  drop column stripe_default_currency;

alter type payment_method add value if not exists 'fincra';

create table fincra_settings (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
  business_id     text not null,
  public_key      text not null,
  secret_key      text not null,
  webhook_secret  text not null,
  is_live         boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- RLS enabled with ZERO policies: no client role (anon or authenticated) can
-- select, insert, update, or delete this table directly — only the two
-- security-definer functions below, and the fincra-checkout edge function
-- via the service-role key, ever touch it.
alter table fincra_settings enable row level security;

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

-- Client-safe read: never returns secret_key or webhook_secret.
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
