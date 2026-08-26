"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Signup collects the business name up front so the tenant can be created
 * in the same flow. Two paths depending on your Supabase Auth email
 * confirmation setting:
 *  - Confirmations OFF (fastest onboarding, fine while validating the idea):
 *    signUp() returns a live session immediately, so we call the
 *    create_tenant_for_current_user() RPC right here and go straight to /dashboard.
 *  - Confirmations ON (recommended once you have real customers): there is
 *    no session yet, so we show a "check your email" state; the email link
 *    lands on /auth/callback, which exchanges the code for a session and
 *    redirects to /onboarding to finish tenant creation.
 */
export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { pending_business_name: form.businessName, pending_owner_name: form.ownerName },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      // Email confirmation required — tenant gets created at /onboarding after they click the link.
      setLoading(false);
      setAwaitingConfirmation(true);
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_tenant_for_current_user", {
      business_name: form.businessName,
      owner_full_name: form.ownerName,
      business_phone: form.phone || null,
    });

    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-serif text-lg font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-slate-500">
            We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your shop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-100">
            <Scissors className="h-5 w-5 text-brand-700" />
          </div>
        </div>
        <h1 className="mt-3 text-center font-serif text-xl font-semibold text-slate-900">Set up your shop</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Tell us about your tailoring business to get started.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Business name" value={form.businessName} onChange={(v) => update("businessName", v)} required />
          <Field label="Your name" value={form.ownerName} onChange={(v) => update("ownerName", v)} required />
          <Field label="Shop phone / WhatsApp" value={form.phone} onChange={(v) => update("phone", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} required />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? "Creating your shop…" : "Create shop"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
