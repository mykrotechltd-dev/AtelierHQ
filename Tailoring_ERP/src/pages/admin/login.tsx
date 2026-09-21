import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
  FileClock,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client.ts";
import { useAdminSession } from "@/components/providers/admin-auth.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "credentials" | "code";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { status } = useAdminSession();
  const [step, setStep] = useState<Step>("credentials");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AdminAuthProvider (shared with AdminLayout via App.tsx) is the single
  // place is_platform_admin() gets checked. This page just reacts to its
  // resolved status instead of running its own second check. While the
  // verification-code step is showing, hold off navigating so the person can
  // finish it.
  useEffect(() => {
    if (status === "authenticated" && step !== "code") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [status, step, navigate]);

  const handleCredentials = async (e: React.FormEvent) => {
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

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    // If this account has an authenticator enrolled, ask for the code before
    // handing over. Accounts without one carry straight on: enrolment and
    // server-side enforcement are a separate step, so this never locks an
    // admin out.
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
        setStep("code");
      }
    }
    setSubmitting(false);
    // Do not sign out and do not navigate here: this is the same Supabase
    // client/session the tenant-facing app uses, and these credentials may
    // belong to a real, currently-logged-in shop owner. onAuthStateChange
    // in AdminAuthProvider picks this sign-in up and resolves status; the
    // effect above navigates on "authenticated", and "forbidden" renders
    // inline below without ending anyone's session.
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setSubmitting(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setSubmitting(false);
      setError(challenge.error.message);
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    setSubmitting(false);
    if (verify.error) {
      setError("That code did not work. Check the app and try again.");
      return;
    }
    setStep("credentials");
  };

  const busy = submitting || status === "loading";

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_1fr]">
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-sidebar p-8 text-sidebar-foreground md:p-12">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles className="size-[18px]" />
          </span>
          <div>
            <p className="font-sans text-base font-semibold leading-tight text-sidebar-accent-foreground">
              AtelierHQ
              <span className="ml-1.5 align-[2px] font-mono text-[9.5px] font-medium tracking-[0.14em] text-sidebar-primary">
                ADMIN
              </span>
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              Platform control
            </p>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-1/2 hidden size-[34rem] -translate-y-1/2 rounded-full border border-sidebar-primary/20 lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-1/2 hidden size-96 -translate-y-1/2 rounded-full border border-sidebar-primary/30 lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-8 top-1/2 hidden size-64 -translate-y-1/2 rounded-full border border-sidebar-primary/45 lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[8.5rem] top-1/2 hidden size-20 -translate-y-1/2 place-items-center rounded-3xl bg-sidebar-primary text-sidebar-primary-foreground lg:grid"
        >
          <Sparkles className="size-8" />
        </div>

        <div className="relative z-10 max-w-md">
          <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-primary">
            Restricted workspace
          </p>
          <h2 className="max-w-[14ch] font-sans text-4xl font-semibold leading-[1.05] tracking-tight text-sidebar-accent-foreground md:text-5xl">
            Every atelier,{" "}
            <span className="text-sidebar-primary">one calm</span> console.
          </h2>
          <p className="mt-4 max-w-[38ch] text-sm text-sidebar-foreground/70">
            Monitor shops, subscriptions and activity across the platform. Built
            for the few people who keep AtelierHQ running.
          </p>
        </div>

        <ul className="relative z-10 hidden gap-3 font-mono text-[11.5px] uppercase tracking-wider text-sidebar-foreground/65 lg:grid">
          <li className="flex items-center gap-3">
            <ShieldCheck className="size-4 text-sidebar-primary" /> Platform
            staff only
          </li>
          <li className="flex items-center gap-3">
            <KeyRound className="size-4 text-sidebar-primary" /> Two-step
            verification supported
          </li>
          <li className="flex items-center gap-3">
            <FileClock className="size-4 text-sidebar-primary" /> Every action
            is written to the audit log
          </li>
        </ul>
      </aside>

      <main className="grid place-items-center px-5 py-10 md:px-8">
        <div className="grid w-full max-w-sm gap-6">
          {step === "credentials" ? (
            <>
              <div>
                <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Staff sign-in
                </p>
                <h1 className="font-sans text-3xl font-semibold tracking-tight">
                  Sign in to Platform Admin
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Use your AtelierHQ staff account.
                </p>
              </div>

              <form
                onSubmit={handleCredentials}
                className="grid gap-4"
                noValidate
              >
                <div className="grid gap-2">
                  <Label htmlFor="admin-email">Work email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-11"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1.5 grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {!error && status === "forbidden" && (
                  <p role="alert" className="text-sm text-destructive">
                    This login is for AtelierHQ staff only.
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={busy}
                  className="w-full"
                >
                  {busy ? "Signing in…" : "Continue"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div>
                <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Step 2 of 2
                </p>
                <h1 className="font-sans text-3xl font-semibold tracking-tight">
                  Enter your verification code
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Open your authenticator app and type the 6-digit code for
                  AtelierHQ.
                </p>
              </div>
              <form onSubmit={handleCode} className="grid gap-4" noValidate>
                <div className="grid gap-2">
                  <Label htmlFor="admin-code">Verification code</Label>
                  <Input
                    id="admin-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="h-12 text-center font-mono text-xl tracking-[0.5em]"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={busy}
                  className="w-full"
                >
                  {busy ? "Verifying…" : "Verify and sign in"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setStep("credentials");
                    setCode("");
                    setError(null);
                  }}
                >
                  Back
                </Button>
              </form>
            </>
          )}

          <p className="text-center font-mono text-[10.5px] uppercase leading-relaxed tracking-wider text-muted-foreground">
            All sensitive actions are audited
          </p>
        </div>
      </main>
    </div>
  );
}
