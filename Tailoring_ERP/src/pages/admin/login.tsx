import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client.ts";
import { useAdminSession } from "@/components/providers/admin-auth.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card } from "@/components/ui/card.tsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { status } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AdminAuthProvider (shared with AdminLayout via App.tsx) is the single
  // place is_platform_admin() gets checked. This page just reacts to its
  // resolved status instead of running its own second check.
  useEffect(() => {
    if (status === "authenticated") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length === 0) {
      setError("Password is required.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    // Do not sign out and do not navigate here: this is the same Supabase
    // client/session the tenant-facing app uses, and these credentials may
    // belong to a real, currently-logged-in shop owner. onAuthStateChange
    // in AdminAuthProvider will pick this sign-in up and resolve status —
    // the effect above navigates on "authenticated"; "forbidden" renders
    // inline below without ending anyone's session.
  };

  const busy = submitting || status === "loading";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm gap-0 p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary shrink-0" />
          <h1 className="font-sans text-2xl font-semibold text-foreground">
            AtelierHQ Admin
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform operator access only — not for shop accounts.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && status === "forbidden" && (
            <p className="text-sm text-destructive">
              This login is for AtelierHQ staff only.
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
