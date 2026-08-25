import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type Stripe from "stripe";

/**
 * Stripe webhook — the one place the service-role client is legitimate,
 * because there's no logged-in user session on a server-to-server callback.
 * Signature verification is what stops anyone from POSTing fake "subscription
 * activated" events at this URL.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenant_id;
      if (!tenantId) break;

      const planNickname = sub.items.data[0]?.price?.nickname ?? "pro";
      const status =
        sub.status === "trialing" ? "trialing" : sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";

      await supabase
        .from("tenants")
        .update({
          stripe_subscription_id: sub.id,
          subscription_status: status,
          plan: planNickname,
        })
        .eq("id", tenantId);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenant_id;
      if (!tenantId) break;
      await supabase.from("tenants").update({ subscription_status: "canceled" }).eq("id", tenantId);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
