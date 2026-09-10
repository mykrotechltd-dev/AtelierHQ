import { createClient } from "@supabase/supabase-js";

/**
 * Left untyped (no `<Database>` generic) — see the note in types.ts. A
 * hand-written generic here does more harm than good: it makes every
 * `.from()`/`.rpc()` call resolve to `never` instead of useful types. The
 * query modules in `src/lib/queries/` map raw rows to typed app objects at
 * the boundary instead.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
