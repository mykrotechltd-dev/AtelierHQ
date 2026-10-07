import { expect, it, vi } from "vitest";
import { useStartSubscriptionCheckout } from "./billing.ts";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../supabase/client.ts", () => ({
  supabase: { functions: { invoke } },
}));
vi.mock("../../components/providers/auth.tsx", () => ({ useSession: vi.fn() }));

it("surfaces the checkout configuration error to the billing page", async () => {
  const error = Object.assign(
    new Error("Edge Function returned a non-2xx status code"),
    {
      context: new Response(
        JSON.stringify({
          code: "BILLING_PRICE_NOT_CONFIGURED",
          error:
            "The production subscription price is not configured. Please contact support.",
        }),
        { status: 503 },
      ),
    },
  );
  invoke.mockResolvedValue({ data: null, error });
  await expect(useStartSubscriptionCheckout()("standard")).rejects.toThrow(
    /production subscription price is not configured/,
  );
});

it("retains the original error when the response is not JSON", async () => {
  const error = Object.assign(new Error("Network failed"), {
    context: new Response("Unavailable", { status: 503 }),
  });
  invoke.mockResolvedValue({ data: null, error });
  await expect(useStartSubscriptionCheckout()("standard")).rejects.toBe(error);
});
