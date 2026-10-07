import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20261007133723_subscription_live_price_approval.sql",
    import.meta.url,
  ),
  "utf8",
);
const legacy = readFileSync(
  new URL("./0006_subscription_billing.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
// Exercise the actual plans DDL and seed, without unrelated auth/pg_net infrastructure.
const legacyPlans = legacy.slice(
  legacy.indexOf("create table plans ("),
  legacy.indexOf("alter table plans enable"),
);
const schemaPlans = schema.slice(
  schema.indexOf("create table plans ("),
  schema.indexOf("create table tenants ("),
);
let db: PGlite;
afterEach(async () => {
  await db?.close();
});

async function load(sql: string) {
  db = new PGlite();
  await db.exec(sql);
}

describe("live subscription price approval", () => {
  it("upgrades the legacy active placeholder without approving or disabling sandbox pricing", async () => {
    await load(legacyPlans);
    await db.exec(migration);
    const { rows } = await db.query(
      "select * from plans where code = 'standard'",
    );
    expect(rows[0]).toMatchObject({
      amount: "5000.00",
      currency: "NGN",
      is_active: true,
      live_price_amount: null,
      live_price_currency: null,
    });
  });

  it("preserves manually configured prices but requires explicit approval", async () => {
    await load(legacyPlans);
    await db.exec("update plans set amount = 7500, currency = 'USD';");
    await db.exec(migration);
    const { rows } = await db.query(
      "select * from plans where code = 'standard'",
    );
    expect(rows[0]).toMatchObject({
      amount: "7500.00",
      currency: "USD",
      live_price_amount: null,
      live_price_currency: null,
    });
  });

  it("seeds fresh installations without live approval", async () => {
    await load(schemaPlans);
    const { rows } = await db.query(
      "select * from plans where code = 'standard'",
    );
    expect(rows[0]).toMatchObject({
      is_active: true,
      live_price_amount: null,
      live_price_currency: null,
    });
  });

  it("allows an atomic price decision and prevents partial or stale approvals", async () => {
    await load(legacyPlans);
    await db.exec(migration);
    await db.exec(
      "update plans set amount = 7500, currency = 'USD', live_price_amount = 7500, live_price_currency = 'USD';",
    );
    await expect(db.exec("update plans set amount = 8000;")).rejects.toThrow(
      /plans_live_price_approval/,
    );
    await expect(db.exec("update plans set currency = 'NGN';")).rejects.toThrow(
      /plans_live_price_approval/,
    );
    await expect(
      db.exec("update plans set live_price_currency = null;"),
    ).rejects.toThrow(/plans_live_price_approval/);
    await db.exec(
      "update plans set live_price_amount = null, live_price_currency = null, amount = 8000;",
    );
    const { rows } = await db.query(
      "select * from plans where code = 'standard'",
    );
    expect(rows[0]).toMatchObject({
      amount: "8000.00",
      live_price_amount: null,
      live_price_currency: null,
    });
  });

  it.each([
    [0, "NGN"],
    [-1, "NGN"],
    [5000, ""],
    [5000, "ngn"],
    ["NaN", "NGN"],
  ])("rejects approval of invalid price %s %s", async (amount, currency) => {
    await load(legacyPlans);
    await db.exec(migration);
    await expect(
      db.query(
        "update plans set amount = $1, currency = $2, live_price_amount = $1, live_price_currency = $2",
        [amount, currency],
      ),
    ).rejects.toThrow(/plans_live_price_approval/);
  });

  it("new plans also start unapproved", async () => {
    await load(legacyPlans);
    await db.exec(migration);
    await db.exec(
      "insert into plans (code, name, amount, currency) values ('pro', 'Pro', 10000, 'NGN');",
    );
    const { rows } = await db.query("select * from plans where code = 'pro'");
    expect(rows[0]).toMatchObject({
      live_price_amount: null,
      live_price_currency: null,
    });
  });
});
