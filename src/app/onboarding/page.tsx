import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Finishes tenant creation for a user who just confirmed their email.
 * If a profile already exists (returning user, or the fast no-confirmation
 * path already created it), skip straight to the dashboard. Otherwise call
 * the same create_tenant_for_current_user() RPC used in the immediate-session
 * signup path, seeded from the metadata stashed during signUp().
 */
export default async function OnboardingPage() {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    redirect("/dashboard");
  }

  const businessName = (user.user_metadata?.pending_business_name as string) || "My Tailoring Shop";
  const ownerName = (user.user_metadata?.pending_owner_name as string) || user.email || "Owner";

  const { error } = await supabase.rpc("create_tenant_for_current_user", {
    business_name: businessName,
    owner_full_name: ownerName,
    business_phone: null,
  });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Couldn't finish setting up your shop: {error.message}. Contact support.
        </div>
      </div>
    );
  }

  redirect("/dashboard");
}
