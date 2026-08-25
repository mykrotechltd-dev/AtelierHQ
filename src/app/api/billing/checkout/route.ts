import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser, requireRole } from "@/lib/utils/tenant";
import { stripe, PRICE_BY_PLAN } from "@/lib/billing/stripe";

/**
 * Starts a Stripe Checkout session for the caller's tenant to upgrade off
 * the trial. Only owner/admin can change billing. The tenant's
 * stripe_customer_id is created lazily on first checkout and persisted so
 * future checkouts/portal sessions reuse the same Stripe customer.
 */
export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  requireRole(user, ["owner", "admin"]);

  const { plan } = (await request.json()) as { plan: "starter" | "pro" };
  if (!PRICE_BY_PLAN[plan]) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, stripe_customer_id, name")
    .eq("id", user.tenantId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  let customerId = tenant.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: { tenant_id: tenant.id },
    });
    customerId = customer.id;
    await supabase.from("tenants").update({ stripe_customer_id: customerId }).eq("id", tenant.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRICE_BY_PLAN[plan], quantity: 1 }],
    // tenant_id travels through so the webhook can update the right row
    // without trusting anything the client sends back.
    subscription_data: { metadata: { tenant_id: tenant.id } },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?billing=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
