import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { admin } = vi.hoisted(() => ({
  admin: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => admin,
}));

let handler: (req: Request) => Promise<Response>;
let provider: ReturnType<typeof vi.fn>;
const seed = {
  code: "standard",
  name: "AtelierHQ Standard",
  amount: 5000,
  currency: "NGN",
  interval_days: 30,
  is_active: true,
};

async function checkout(plan = seed, live = true) {
  vi.resetModules();
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        key === "PLATFORM_FINCRA_LIVE" ? String(live) : "test",
    },
    serve: (callback: typeof handler) => {
      handler = callback;
    },
  });
  admin.auth.getUser.mockResolvedValue({
    data: { user: { id: "owner", email: "owner@example.com" } },
    error: null,
  });
  admin.from.mockImplementation((table: string) => {
    const data =
      table === "profiles"
        ? { tenant_id: "tenant", role: "owner" }
        : table === "tenants"
          ? { id: "tenant", name: "Test Atelier" }
          : plan;
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({ data, error: null }),
      maybeSingle: async () => ({ data, error: null }),
    };
    return query;
  });
  await import("./index.ts");
  return handler(
    new Request("https://example.com/subscription-billing/checkout", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planCode: plan.code }),
    }),
  );
}

beforeEach(() => {
  provider = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ data: { link: "https://checkout.example.com" } }),
      ),
    );
  vi.stubGlobal("fetch", provider);
});
afterEach(() => vi.unstubAllGlobals());

describe("subscription checkout pricing", () => {
  it.each([
    ["legacy placeholder", seed],
    [
      "unapproved migrated placeholder",
      { ...seed, live_price_amount: null, live_price_currency: null },
    ],
    ["changed but unapproved price", { ...seed, amount: 7500 }],
    [
      "stale amount approval",
      {
        ...seed,
        amount: 7500,
        live_price_amount: 5000,
        live_price_currency: "NGN",
      },
    ],
    [
      "stale currency approval",
      {
        ...seed,
        currency: "USD",
        live_price_amount: 5000,
        live_price_currency: "NGN",
      },
    ],
    [
      "invalid amount",
      { ...seed, amount: 0, live_price_amount: 0, live_price_currency: "NGN" },
    ],
    [
      "invalid currency",
      {
        ...seed,
        currency: "",
        live_price_amount: 5000,
        live_price_currency: "",
      },
    ],
  ])("blocks %s in live mode before contacting Fincra", async (_name, plan) => {
    const response = await checkout(plan);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "BILLING_PRICE_NOT_CONFIGURED",
      error: expect.stringMatching(/production.*price/i),
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("keeps the seed usable in sandbox", async () => {
    const response = await checkout(seed, false);
    expect(response.status).toBe(200);
    expect(provider.mock.calls[0][0]).toBe(
      "https://sandboxapi.fincra.com/checkout/payments",
    );
    expect(JSON.parse(provider.mock.calls[0][1].body)).toMatchObject({
      amount: 5000,
      currency: "NGN",
    });
  });

  it.each([5000, 7500])(
    "bills an explicitly approved price of %s without substituting a guessed price",
    async (amount) => {
      const response = await checkout({
        ...seed,
        amount,
        live_price_amount: amount,
        live_price_currency: "NGN",
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        url: "https://checkout.example.com",
      });
      expect(provider.mock.calls[0][0]).toBe(
        "https://api.fincra.com/checkout/payments",
      );
      expect(JSON.parse(provider.mock.calls[0][1].body)).toMatchObject({
        amount,
        currency: "NGN",
      });
    },
  );
});
