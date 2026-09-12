import { useAdminSession } from "../components/providers/admin-auth.tsx";
import { supabase } from "../lib/supabase/client.ts";

export function useAdminAuth() {
  const { session, status } = useAdminSession();
  return {
    session,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    signout: () => supabase.auth.signOut(),
  };
}
