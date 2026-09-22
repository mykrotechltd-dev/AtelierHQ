// Exercises supabase/migrations/0009-0011 (the notification outbox, its
// trigger, and the rollout gate) against a REAL Postgres engine — PGlite,
// Postgres compiled to WASM, not a hand-rolled mock of trigger/RLS
// semantics. This is the same approach used ad hoc to verify 0008's
// migration before it shipped; committed here (per the architecture
// review's integration plan) so it runs in CI/on every future change
// instead of being a one-off manual check.
//
// What PGlite genuinely can't provide: pg_net (needs real network I/O and
// background workers, incompatible with its WASM sandbox). Two
// accommodations for that, both narrowly scoped to this gap alone:
//   - 0011's cumulative schema.sql text has its one
//     "create extension if not exists pg_net;" line stripped before
//     loading.
//   - net.http_post is stubbed with the real function signature (named
//     params, returns bigint) so 0011's dispatch_notification_via_pg_net()
//     trigger runs completely unmodified and its call gets captured for
//     assertions, rather than skipped.
// Every table, trigger, function, RLS setting and index is the real thing
// from the real cumulative schema.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";

const SCHEMA_PATH = path.resolve(import.meta.dirname, "../schema.sql");

interface OutboxRow {
  id: number;
  tenant_id: string;
  order_id: string;
  customer_id: string;
  to_status: string;
  template_key: string;
  status: string;
  last_error: string | null;
  pg_net_request_id: number | null;
}

let db: PGlite;
let tenantId: string;
let customerWithPhoneId: string;
let customerNoPhoneId: string;
// Set by the first status-change test, read by the ones that build on it —
// tests in this file run in declaration order and share one PGlite
// instance deliberately (see the file header).
let order1Id: string;

async function makeOrder(customerId: string, orderNumber: string) {
  const {
    rows: [order],
  } = await db.query<{ id: string }>(
    `insert into orders (tenant_id, customer_id, order_number, status)
     values ($1, $2, $3, 'received') returning id`,
    [tenantId, customerId, orderNumber],
  );
  return order.id;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });

  // Stub what schema.sql assumes exists on real Supabase infrastructure
  // but PGlite starts without: the auth schema/auth.uid(), and the
  // authenticated/service_role roles referenced by grants throughout the
  // schema (e.g. 0008's `grant execute ... to authenticated`).
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key, email text);
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.uid', true), '')::uuid;
    $$;
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end
    $$;
  `);

  const schemaSql = readFileSync(SCHEMA_PATH, "utf8").replace(
    /create extension if not exists pg_net;/,
    "-- (stripped for local testing — pg_net needs real network I/O; see this file's header)",
  );
  await db.exec(schemaSql);

  // Stub net.http_post with the real signature so
  // dispatch_notification_via_pg_net() (0011) runs unmodified.
  await db.exec(`
    create schema if not exists net;
    create sequence if not exists net.request_id_seq;
    create table if not exists net.captured_calls (
      id bigint primary key,
      url text,
      body jsonb,
      headers jsonb
    );
    create or replace function net.http_post(
      url text,
      body jsonb default '{}'::jsonb,
      params jsonb default '{}'::jsonb,
      headers jsonb default '{}'::jsonb,
      timeout_milliseconds int default 5000
    ) returns bigint
    language plpgsql
    as $$
    declare
      v_id bigint := nextval('net.request_id_seq');
    begin
      insert into net.captured_calls (id, url, body, headers) values (v_id, url, body, headers);
      return v_id;
    end;
    $$;
  `);

  // A tenant opted into the rollout gate (0011) — notify_sender_name set —
  // plus one customer with a phone and one without, shared across the
  // tests below. Tests run in declaration order and build on this shared
  // state deliberately, the same way the ad hoc script this replaces did.
  const {
    rows: [tenant],
  } = await db.query<{ id: string }>(
    `insert into tenants (name, phone, notify_sender_name)
     values ('Test Atelier', '+15550000000', 'Test Atelier') returning id`,
  );
  tenantId = tenant.id;

  const {
    rows: [withPhone],
  } = await db.query<{ id: string }>(
    `insert into customers (tenant_id, name, phone) values ($1, 'Amaka Obi', '+2348012345678') returning id`,
    [tenantId],
  );
  customerWithPhoneId = withPhone.id;

  const {
    rows: [noPhone],
  } = await db.query<{ id: string }>(
    `insert into customers (tenant_id, name, phone) values ($1, 'No Phone Customer', null) returning id`,
    [tenantId],
  );
  customerNoPhoneId = noPhone.id;
});

describe("0009-0011: notification_outbox and its trigger", () => {
  it("loaded the full cumulative schema with no error", async () => {
    const { rows } = await db.query(
      `select 1 from information_schema.tables where table_name = 'notification_outbox'`,
    );
    expect(rows).toHaveLength(1);
  });

  it("received -> in_progress enqueues nothing", async () => {
    const orderId = await makeOrder(customerWithPhoneId, "ORD-1");
    await db.query(`update orders set status = 'in_progress' where id = $1`, [orderId]);

    const { rows } = await db.query(
      `select * from notification_outbox where order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(0);

    // Advance it to 'completed' here so the next test has a fixture ready
    // — this is the "exactly one row per eligible transition" case.
    await db.query(`update orders set status = 'completed' where id = $1`, [orderId]);
    order1Id = orderId;
  });

  it("in_progress -> completed enqueues exactly one row, dispatched via pg_net", async () => {
    const orderId = order1Id;

    const { rows } = await db.query<OutboxRow>(
      `select * from notification_outbox where order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].template_key).toBe("order_completed");
    expect(rows[0].to_status).toBe("completed");
    expect(rows[0].status).toBe("pending");
    expect(rows[0].tenant_id).toBe(tenantId);
    expect(rows[0].pg_net_request_id).not.toBeNull();

    const { rows: calls } = await db.query<{ id: number; body: unknown }>(
      `select * from net.captured_calls`,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe(rows[0].pg_net_request_id);
    const body = calls[0].body as {
      type: string;
      table: string;
      schema: string;
      record: { id: number; to_status: string; status: string };
    };
    expect(body.type).toBe("INSERT");
    expect(body.table).toBe("notification_outbox");
    expect(body.schema).toBe("public");
    expect(body.record.id).toBe(rows[0].id);
    expect(body.record.to_status).toBe("completed");
  });

  it("completed -> delivered enqueues a second row for the same order", async () => {
    const orderId = order1Id;
    await db.query(`update orders set status = 'delivered' where id = $1`, [orderId]);

    const { rows } = await db.query<OutboxRow>(
      `select * from notification_outbox where order_id = $1 order by id`,
      [orderId],
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].template_key).toBe("order_delivered");
    expect(rows[1].to_status).toBe("delivered");
  });

  it("a customer with no phone gets a 'skipped' row and the order write still succeeds", async () => {
    const orderId = await makeOrder(customerNoPhoneId, "ORD-2");
    await db.query(`update orders set status = 'in_progress' where id = $1`, [orderId]);

    await expect(
      db.query(`update orders set status = 'completed' where id = $1`, [orderId]),
    ).resolves.not.toThrow();

    const {
      rows: [order],
    } = await db.query<{ status: string }>(
      `select status from orders where id = $1`,
      [orderId],
    );
    expect(order.status).toBe("completed");

    const { rows } = await db.query<OutboxRow>(
      `select * from notification_outbox where order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("skipped");
    expect(rows[0].last_error).toBe("no phone on file");
  });

  it("a tenant not opted into the rollout gate (notify_sender_name is null) gets zero rows", async () => {
    const {
      rows: [ungatedTenant],
    } = await db.query<{ id: string }>(
      `insert into tenants (name, phone) values ('Not Yet Opted In', '+15550009999') returning id`,
    );
    const {
      rows: [customer],
    } = await db.query<{ id: string }>(
      `insert into customers (tenant_id, name, phone) values ($1, 'Someone', '+15550001111') returning id`,
      [ungatedTenant.id],
    );
    const {
      rows: [order],
    } = await db.query<{ id: string }>(
      `insert into orders (tenant_id, customer_id, order_number, status)
       values ($1, $2, 'ORD-GATE', 'in_progress') returning id`,
      [ungatedTenant.id, customer.id],
    );

    await db.query(`update orders set status = 'completed' where id = $1`, [order.id]);

    const { rows } = await db.query<OutboxRow>(
      `select * from notification_outbox where order_id = $1`,
      [order.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("re-inserting the same (order_id, to_status) is a silent no-op, not a duplicate", async () => {
    const orderId = order1Id;
    await expect(
      db.query(
        `insert into notification_outbox (tenant_id, order_id, customer_id, to_status, template_key, status)
         values ($1, $2, $3, 'delivered', 'order_delivered', 'pending')
         on conflict (order_id, to_status) do nothing`,
        [tenantId, orderId, customerWithPhoneId],
      ),
    ).resolves.not.toThrow();

    const {
      rows: [{ n }],
    } = await db.query<{ n: number }>(
      `select count(*)::int as n from notification_outbox where order_id = $1 and to_status = 'delivered'`,
      [orderId],
    );
    expect(n).toBe(1);
  });

  it("has RLS enabled with zero policies", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where relname = 'notification_outbox'`,
    );
    expect(rows[0]?.relrowsecurity).toBe(true);

    const { rows: policies } = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies where tablename = 'notification_outbox'`,
    );
    expect(policies[0].n).toBe(0);
  });

  it("blocks a client-role (authenticated) select even when granted table access", async () => {
    // Mirrors how real Supabase projects work: PostgREST's anon/authenticated
    // roles hold a platform-level GRANT SELECT on every public table, and
    // RLS — not the grant — is what actually gates access. Grant it here so
    // this test isolates RLS as the thing actually being verified, rather
    // than accidentally testing "no grant exists" instead.
    await db.exec(`grant select on notification_outbox to authenticated;`);

    // Sanity check first: rows genuinely exist right now (as the superuser
    // session PGlite runs as, which bypasses RLS).
    const { rows: asSuperuser } = await db.query(`select 1 from notification_outbox`);
    expect(asSuperuser.length).toBeGreaterThan(0);

    await db.exec(`set role authenticated;`);
    try {
      const { rows: asAuthenticated } = await db.query(`select * from notification_outbox`);
      // RLS enabled + zero policies => a non-bypassing role sees nothing,
      // even with an explicit table-level grant.
      expect(asAuthenticated).toHaveLength(0);
    } finally {
      await db.exec(`reset role;`);
    }
  });
});

describe("0012: admin_list_notifications", () => {
  it("rejects a caller that isn't a platform admin", async () => {
    await db.exec(`set request.jwt.uid = '';`); // simulates no session at all
    await expect(db.query(`select admin_list_notifications(10)`)).rejects.toThrow(
      /Not authorized/,
    );
  });

  it("returns notification_outbox rows for a platform admin, and logs the read", async () => {
    const {
      rows: [adminUser],
    } = await db.query<{ id: string }>(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'admin@atelier.test') returning id`,
    );
    await db.query(`insert into platform_admins (id, email) values ($1, 'admin@atelier.test')`, [
      adminUser.id,
    ]);
    await db.exec(`set request.jwt.uid = '${adminUser.id}';`);

    const {
      rows: [{ admin_list_notifications: result }],
    } = await db.query<{ admin_list_notifications: unknown[] }>(
      `select admin_list_notifications(10)`,
    );
    expect(Array.isArray(result)).toBe(true);
    expect((result as Record<string, unknown>[]).length).toBeGreaterThan(0);
    const first = (result as Record<string, unknown>[])[0];
    expect(first).toHaveProperty("toStatus");
    expect(first).toHaveProperty("status");
    expect(first).toHaveProperty("tenantName");

    const { rows: logRows } = await db.query<{ n: number }>(
      `select count(*)::int as n from admin_access_log where action = 'list_notifications'`,
    );
    expect(logRows[0].n).toBeGreaterThan(0);

    await db.exec(`set request.jwt.uid = '';`);
  });
});
