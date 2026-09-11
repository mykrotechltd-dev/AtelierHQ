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
// Deliberately only three states, not a fourth "forbidden" one: signing a
// non-admin session out fires another onAuthStateChange(null) through this
// same effect, which would immediately overwrite a "forbidden" state with
// "unauthenticated" anyway. The login page owns its own error message
// instead of trusting this context to hold a transient rejection reason.
type AdminStatus = "loading" | "authenticated" | "unauthenticated";

interface AdminSessionContextValue {
  session: Session | null;
  status: AdminStatus;
}

const AdminSessionContext = createContext<AdminSessionContextValue>({
  session: null,
  status: "loading",
});

export async function checkIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) return false;
  return data === true;
}

export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AdminStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function resolve(newSession: Session | null) {
      if (!newSession) {
        if (!cancelled) {
          setSession(null);
          setStatus("unauthenticated");
        }
        return;
      }
      const isAdmin = await checkIsPlatformAdmin();
      if (cancelled) return;
      if (!isAdmin) {
        // A real, valid login — just not a platform admin. Don't leave a
        // non-admin session sitting authenticated against the admin app.
        await supabase.auth.signOut();
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
