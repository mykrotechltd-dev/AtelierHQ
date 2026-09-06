import { useSession } from "../components/providers/auth.tsx";
import { supabase } from "../lib/supabase/client.ts";

export function useAuth() {
  const { session, status } = useSession();
  return {
    session,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    signout: () => supabase.auth.signOut(),
  };
}
