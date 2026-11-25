# AtelierHQ

AtelierHQ is a web-based workspace for tailoring businesses. It brings shop operations together in one place, including customers, garment orders, worker tasks, payments, reports, patterns, billing, and shop settings. The application also has a separate platform-admin area.

**Live app:** [tailoringerp.vercel.app](https://tailoringerp.vercel.app)  
**Application source:** [`Tailoring_ERP/`](./Tailoring_ERP)

## Tech stack

- React 19, TypeScript, and Vite
- Tailwind CSS 4 and Radix UI components
- Supabase for authentication, PostgreSQL, and backend functions
- React Router and TanStack Query
- Vitest, Testing Library, and ESLint
- Vercel deployment configuration is included in `Tailoring_ERP/vercel.json`

## Requirements

Install a current Node.js LTS release with npm. You will also need access to a Supabase project for database and authentication services.

## Run locally

1. Clone the repository and enter the app directory:

   ```bash
   git clone https://github.com/mykrotechltd-dev/AtelierHQ.git
   cd AtelierHQ/Tailoring_ERP
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Create a `.env.local` file in `Tailoring_ERP/` with your Supabase project values:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

   Find these values in your Supabase project settings (the project URL and the publishable/anon key). These are browser-side settings; **never** put a Supabase service-role key, database password, or payment-provider secret in a `VITE_` variable.

4. Set up your Supabase database and authentication (see below).

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open the URL printed by Vite (normally [http://localhost:5173](http://localhost:5173)).

## Supabase setup

The frontend expects a Supabase project. Its client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment. The database schema is in [`Tailoring_ERP/supabase/schema.sql`](./Tailoring_ERP/supabase/schema.sql), and incremental SQL changes are in [`Tailoring_ERP/supabase/migrations/`](./Tailoring_ERP/supabase/migrations/).

For a new project:

1. Create a Supabase project and copy its project URL and publishable/anon key into `.env.local`.
2. In the Supabase SQL Editor, install the database schema from `supabase/schema.sql`.
3. Review the numbered migration files (`0001` through `0007`) and apply changes that are not already included in the schema, in numeric order. Some migration comments describe changes already incorporated into `schema.sql`; avoid reapplying those changes to a database that already contains them.
4. In Supabase Authentication settings, configure the site URL and allowed redirect URLs for local development (`http://localhost:5173`) and your deployed app domain. Confirm email/password sign-in and password reset redirects match the app routes.
5. If you use the payment or subscription features, configure the required Supabase Edge Functions and provider secrets in Supabase's server-side secrets configuration. Do not expose private provider credentials in this frontend repository. Function source lives under `supabase/functions/`.

If you use Supabase CLI and have it installed and authenticated, you can link the project with `supabase link --project-ref YOUR_PROJECT_ID`. Use the dashboard SQL Editor or your reviewed migration workflow to apply the SQL; do not blindly run migrations against a database whose schema already includes those changes.

## Available scripts

Run these from `Tailoring_ERP/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest test suite once |
| `npm run lint` | Run ESLint |
| `npm run prettier-check` | Check formatting |
| `npm run prettier-fix` | Format files with Prettier |

Before deploying, run at least `npm run build`, `npm test`, and `npm run lint`.

## Deploy to Vercel

The included Vercel configuration uses Vite and rewrites routes to `index.html` for the React Router app. To deploy:

1. Import this GitHub repository into Vercel.
2. Set the project **Root Directory** to `Tailoring_ERP`.
3. Use the Vite framework preset. The build command is `npm run build`; the output directory is `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Vercel environment variables for the environments you deploy.
5. Add the deployed domain to Supabase Authentication's site and redirect URL settings.
6. Deploy, then test sign-up/sign-in, onboarding, and a direct refresh on an application route.

The repository currently points to [tailoringerp.vercel.app](https://tailoringerp.vercel.app). If you deploy to a different domain, update the Supabase redirect configuration accordingly.

## Main application areas

- **Shop workspace:** dashboard, customers, orders, workers, tasks, payments, patterns, reports, billing, and settings.
- **Account flow:** sign-up, sign-in, authentication callback, password recovery, and shop onboarding.
- **Platform administration:** a separate `/admin` area for platform-level dashboards, orders, clients, scheduling, inventory, staff, and shops.

## Repository layout

```text
AtelierHQ/
├── README.md
└── Tailoring_ERP/
    ├── src/                 # React app, routes, components, hooks, and queries
    ├── supabase/
    │   ├── functions/       # Supabase Edge Functions
    │   ├── migrations/      # Incremental database SQL
    │   └── schema.sql       # Database schema
    ├── package.json
    ├── vite.config.ts
    └── vercel.json
```

## Troubleshooting

- **Supabase URL/key error:** check the spelling and values in `Tailoring_ERP/.env.local`, then restart the Vite server after editing it.
- **Authentication redirect error:** add the exact local or deployed URL to Supabase Authentication's allowed redirect URLs.
- **Database errors after setup:** check whether the schema already includes the relevant migration before applying it again; inspect the Supabase logs for the failing query or function.
- **Deep link returns 404 after deployment:** confirm Vercel is using `Tailoring_ERP` as its root directory and that its `vercel.json` rewrite is deployed.

## Security notes

Environment files containing credentials should not be committed. Only public client configuration belongs in `VITE_` variables. Keep service-role keys, database credentials, and payment-provider secrets on trusted server-side infrastructure such as Supabase Edge Function secrets.
