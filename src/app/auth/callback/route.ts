import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Handles the redirect from Supabase email confirmation / magic links.
 * Exchanges the one-time code for a session, then sends the user to
 * /onboarding to finish tenant creation (see signup/page.tsx for context).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
