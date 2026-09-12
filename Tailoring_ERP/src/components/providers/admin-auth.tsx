import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client.ts";

// Deliberately independent of components/providers/auth.tsx (the
// tenant-facing session context). Both ultimately read the same Supabase
// auth client — this project has one Supabase project, not one per
// audience — but the admin area tracks its own status here and layers an
// extra check on top: a valid login is not enough, the signed-in user must
// also have a row in platform_admins (checked via the is_platform_admin()
// RPC, which runs security definer so the anon key can call it without
// itself being able to read platform_admins).
//
// Never call supabase.auth.signOut() from anywhere in this file: it's the
// same client/session the tenant-facing AuthProvider wraps around the
// entire app, so signing out here would log a tenant owner or worker out
// of their own, completely unrelated shop session the moment they land on
// (or are sent a link to) any /admin/* route. A valid-but-non-admin login
// is a "forbidden" state, not a reason to end anyone's session.
type AdminStatus =
  "loading" | "authenticated" | "unauthenticated" | "forbidden";

interface AdminSessionContextValue {
  session: Session | null;
  status: AdminStatus;
}

const AdminSessionContext = createContext<AdminSessionContextValue>({
  session: null,
  status: "loading",
});

/**
 * Retries once before concluding "not admin" — an RPC error (network blip,
 * transient Supabase hiccup) is not the same fact as a confirmed non-admin
 * session, and treating it identically risked (before this file stopped
 * signing sessions out) forcibly logging out a real admin over a passing
 * network error. Still fails closed after the retry: never grant admin
 * access on an ambiguous result.
 */
export async function checkIsPlatformAdmin(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.rpc("is_platform_admin");
    if (!error) return data === true;
  }
  return false;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AdminStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    // getSession() and onAuthStateChange can both kick off a resolve() at
    // nearly the same time (e.g. a token refresh firing while the initial
    // getSession() is still awaiting checkIsPlatformAdmin()). Since each
    // resolve() awaits a real network round trip, they can finish out of
    // order — without this token, an older call finishing last would
    // overwrite the newer, already-current state. Only the resolve() whose
    // token still matches `latest` when it finishes is allowed to apply.
    let latest = 0;

    async function resolve(newSession: Session | null) {
      const token = ++latest;
      if (!newSession) {
        if (!cancelled && token === latest) {
          setSession(null);
          setStatus("unauthenticated");
        }
        return;
      }
      const isAdmin = await checkIsPlatformAdmin();
      if (cancelled || token !== latest) return;
      if (!isAdmin) {
        // A real, valid login — just not a platform admin. The session is
        // left exactly as it was; only this admin context's own status
        // reflects the rejection.
        setSession(newSession);
        setStatus("forbidden");
        return;
      }
      setSession(newSession);
      setStatus("authenticated");
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        resolve(newSession);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <AdminSessionContext.Provider value={{ session, status }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
