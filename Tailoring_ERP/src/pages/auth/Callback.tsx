import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client.ts";
import { Spinner } from "@/components/ui/spinner.tsx";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // supabase-js parses the confirmation link's tokens from the URL
    // (detectSessionInUrl, on by default) and establishes the session
    // before getSession() resolves here.
    supabase.auth.getSession().then(() => {
      navigate("/", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
