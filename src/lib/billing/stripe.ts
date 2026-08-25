import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const PRICE_BY_PLAN: Record<"starter" | "pro", string> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
};
