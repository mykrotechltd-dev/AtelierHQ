-- All existing prices, including manually edited ones, remain usable in sandbox
-- but require an explicit amount/currency decision before live checkout.
-- Do not infer approval from is_active or from a price differing from the seed.
-- NULL defaults also keep newly inserted plans unapproved.
alter table public.plans
  add column live_price_amount numeric(12,2),
  add column live_price_currency text,
  add constraint plans_live_price_approval check (
    (live_price_amount is null and live_price_currency is null)
    or (
      live_price_amount is not null and live_price_currency is not null
      and amount > 0 and amount <> 'NaN'::numeric
      and currency ~ '^[A-Z]{3}$'
      and live_price_amount = amount and live_price_currency = currency
    )
  );

comment on column public.plans.live_price_amount is
  'Explicitly approved live price snapshot; NULL blocks production checkout. Set with amount and currency in one trusted operator update.';
comment on column public.plans.live_price_currency is
  'Currency of the explicitly approved live price. Both snapshot fields must match the current price; see subscription-billing/PRICING.md.';
