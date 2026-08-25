"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — safe to import in Client Components.
 * Uses the anon key only; RLS is what actually protects the data.
 *
 * Left untyped (no `<Database>` generic) until `database.types.ts` is
 * regenerated from the real schema via `npm run db:types` — see the note in
 * that file. Add `<Database>` back once it reflects the live schema; a
 * placeholder generic here does more harm than good (it produces `never`
 * row types everywhere instead of useful autocomplete).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
