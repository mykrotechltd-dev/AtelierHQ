-- ============================================================================
-- Stripe Connect: each tenant (tailoring shop) gets its own connected Stripe
-- account. No Stripe secrets ever live in Postgres — the platform's own
-- secret key is an Edge Function secret, and per-tenant charges are made
-- directly against the tenant's connected account (Stripe-Account header).
-- These columns are just a client-safe cache of what Stripe itself reports,
-- refreshed by the stripe-connect edge function via account.updated webhooks
-- and the account-status route. Run this once in the Supabase SQL Editor.
-- ============================================================================

alter table tenants
  add column stripe_connect_account_id text,
  add column stripe_onboarding_status text not null default 'not_started'
    check (stripe_onboarding_status in ('not_started', 'pending', 'active', 'restricted')),
  add column stripe_country text,
  add column stripe_default_currency text;

alter table payments
  add column external_reference text,
  add column charged_currency text,
  add column charged_amount numeric(12,2);

alter type payment_method add value if not exists 'stripe';
