import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client.ts";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  session: Session | null;
  status: SessionStatus;
}

const SessionContext = createContext<SessionContextValue>({ session: null, status: "loading" });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setStatus(newSession ? "authenticated" : "unauthenticated");
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={{ session, status }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
