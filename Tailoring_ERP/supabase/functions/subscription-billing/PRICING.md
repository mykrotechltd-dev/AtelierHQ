# Configure production subscription pricing

`plans.amount` and `plans.currency` remain the source of the checkout price.
The seeded `standard` plan (5000 NGN) is a **sandbox placeholder**, not an
approved business price. `is_active` only controls plan availability.

When `PLATFORM_FINCRA_LIVE=true`, checkout requires `live_price_amount` and
`live_price_currency` to match the selected plan's exact amount and currency.
Otherwise it returns HTTP 503 with `BILLING_PRICE_NOT_CONFIGURED`, before any
request to Fincra. The billing page displays the configuration error.
Sandbox (`PLATFORM_FINCRA_LIVE=false`, or unset for local development) continues
to use active plans without approval. Never use live Fincra credentials in sandbox.

## One business decision: amount and currency

Choose the final amount in major currency units and the uppercase three-letter
currency supported by your platform Fincra account. This change supplies no
production price. Even a previously edited price needs explicit approval.

Run the following parameterized statement as a trusted database operator,
binding `$1` to the **decided amount**, `$2` to the **decided currency**, and `$3`
to the plan code (for example, `standard`). If using the SQL editor, replace the
parameters with those decided values. No default production values are provided.

```sql
with decided_price as (
  select $1::numeric(12,2) as amount, $2::text as currency
)
update public.plans p
set amount = d.amount,
    currency = d.currency,
    live_price_amount = d.amount,
    live_price_currency = d.currency
from decided_price d
where p.code = $3
returning p.code, p.amount, p.currency, p.live_price_amount, p.live_price_currency;
```

Verify that exactly the intended plan row is returned. This single atomic update
both configures the price and records approval of that exact pair. Approval is
per plan; new plans start unapproved. Client roles have no plan write policy.
The database rejects partial approvals, nonpositive/NaN amounts, malformed
currencies, and changes to an approved price without updating or removing its
approval. To withdraw approval without disabling sandbox availability:

```sql
update public.plans
set live_price_amount = null, live_price_currency = null
where code = 'standard';
```

## Rollout

1. Deploy the guarded `subscription-billing` function first. It also blocks live
   checkout against the old schema, where approval columns are absent.
2. Apply `20261007133723_subscription_live_price_approval.sql` through the normal
   migration process. It preserves prices and active flags, and approves nothing.
   Fresh installations using `schema.sql` have the same unapproved defaults.
3. Make the amount/currency decision above and verify the returned row. Confirm
   the platform Fincra credentials, currency support, and live-mode setting before
   reopening production checkout.

Applying the migration alone does not protect an older deployed function;
the guard must be deployed. Historical migration `0006` is intentionally unchanged.
Webhooks continue to process payments already created before this rollout.

## Tests

Run `npm test` from `Tailoring_ERP`. Tests execute the real checkout handler with
external auth/database/provider boundaries stubbed, the actual plans SQL in
PGlite, and the frontend error propagation. They cover untouched and edited but
unapproved prices, stale approval, explicit approval, sandbox behavior, and
upgrade/fresh-install defaults without contacting Fincra.
