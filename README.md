# AtelierHQ

Multi-tenant CRM/ERP for tailoring shops — orders (with multiple items and a
received → in progress → completed → delivered workflow), customer records
and measurements, worker task assignment and payouts, customer payments and
outstanding balances, PDF invoices shareable via WhatsApp, and daily/monthly
reports. Built on Next.js App Router + Supabase (Postgres, Auth, Storage,
RLS), ready to commercialize as a subscription SaaS.

## Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **Supabase**: Postgres + Row Level Security for multi-tenancy, Auth, Storage
- **Tailwind CSS**
- **Zod** + **react-hook-form** for validated forms
- **@react-pdf/renderer** for invoice PDFs
- **Stripe** for subscription billing (scaffolding only — wire up webhooks before going live)

## Getting started

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) against it (SQL editor or `supabase db push`). This creates every table, enum, trigger, RLS policy, storage bucket, and reporting view the app depends on.
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase URL/keys (Project Settings → API). **Never** put the service-role key behind `NEXT_PUBLIC_*`.
4. `npm install`
5. `npm run dev` and open http://localhost:3000 — sign up, which creates your tenant (business) and owner profile via the `create_tenant_for_current_user()` RPC.
6. Once you have a live schema, regenerate real types: `npm run db:types` (replace `$SUPABASE_PROJECT_ID`), which overwrites the placeholder in `src/lib/supabase/database.types.ts`.

## Project structure

```
supabase/schema.sql          Full schema: tables, enums, triggers, RLS, reporting views, storage policies
src/middleware.ts            Session refresh + route protection
src/lib/supabase/            Browser / server / admin Supabase clients
src/lib/validations/         Zod schemas shared by forms and server actions
src/lib/pdf/invoice.tsx      @react-pdf/renderer invoice template
src/lib/utils/tenant.ts      requireCurrentUser() — resolves the logged-in profile + tenant
src/app/(auth)/              Login / signup
src/app/onboarding/          Finishes tenant creation after email confirmation
src/app/(dashboard)/         Authenticated app shell: dashboard, customers, orders, tasks, payments, reports
src/app/invoices/[orderId]/  PDF generation + WhatsApp share-link route handler
src/components/              UI split by domain (customers, orders, dashboard, ui primitives)
```

## Multi-tenancy model

One shared Postgres schema. Every business table carries `tenant_id`, and
Row Level Security (`current_tenant_id()` in `schema.sql`) makes cross-tenant
reads/writes impossible at the database layer — not just in application
code. This is what lets one Supabase project serve every tailoring shop on
the platform.

## What's scaffolded vs. what you still need to wire up

**Done**: schema + RLS, auth/onboarding, customers + measurements, orders +
items with a guarded status workflow, task assignment/board, customer
payments with overpayment guards, worker payouts, PDF invoices with a
WhatsApp share link, dashboard stats, and a reports page backed by SQL views.

**Left as follow-up** (see the implementation plan in the chat response this
came with): Stripe subscription billing + webhook handler, WhatsApp Business
Cloud API integration for proactive notifications (order ready, payment
reminders — the current WhatsApp button uses `wa.me` deep links, which only
work for outbound taps, not automated sends), the AI assistant (tool-calling
over orders/customers), rate limiting, automated tests, and CI/CD.
