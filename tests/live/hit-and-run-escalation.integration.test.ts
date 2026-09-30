import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const noDbUrl = !DATABASE_URL;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  : null;

// ~77 km outside the Bandung radius that
// tests/live/cancellation-search.integration.test.ts pages. The registration
// trigger only accepts inserts into a published batch, so these fixtures are
// briefly published and must stay out of that suite's result sets.
const FIXTURE_LAT = -7.351234;
const FIXTURE_LNG = 108.152345;

const RUN_TOKEN = `${process.pid}${Math.random().toString(36).slice(2, 8)}`;
const EMAIL_DOMAIN = "hit-and-run.wesup.test";

type Row = Record<string, unknown>;

// Every statement runs on one dedicated connection: the authorization tests
// rely on `request.jwt.claim.sub` being session-scoped, so a pooled per-query
// connection would silently drop the caller between statements.
let client: PoolClient | undefined;

const userIds: string[] = [];
const batchIds: string[] = [];
const registrationIds: string[] = [];
const cleanupFailures: string[] = [];

let owner = "";
let subject = "";
let other = "";

async function rows<T extends object = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await client!.query<T>(text, params as never[]);
  return result.rows;
}

async function one<T extends object = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T> {
  const found = await rows<T>(text, params);
  if (found.length !== 1) {
    throw new Error(`expected exactly 1 row, got ${found.length}: ${text}`);
  }
  return found[0];
}

async function asCaller(userId: string): Promise<void> {
  await rows(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
}

async function createUser(label: string, role: "supplier" | "umkm"): Promise<string> {
  const created = await one<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             'authenticated', 'authenticated', $1, 'x')
     returning id`,
    [`${label}-${RUN_TOKEN}@${EMAIL_DOMAIN}`],
  );
  const id = created.id;
  userIds.push(id);
  // auth.users has an AFTER INSERT trigger (handle_new_user) that already
  // creates the profile row, so these upserts are reconciling, not creating.
  await rows(
    `insert into public.profiles (id, role, status, full_name)
     values ($1, $2, 'active', $3)
     on conflict (id) do update
       set role = $2, status = 'active', full_name = $3`,
    [id, role, `HR ${label}`],
  );
  if (role === "supplier") {
    await rows(
      `insert into public.supplier_profiles
         (user_id, business_name, address, latitude, longitude,
          ktp_photo_url, nik, verification_status)
       values ($1, $2, 'Jl. Fixture No. 1', $3, $4, 'fixture', $5, 'approved')
       on conflict (user_id) do update
         set verification_status = 'approved'`,
      [id, `HR Supplier ${RUN_TOKEN}`, FIXTURE_LAT, FIXTURE_LNG, `NIK-HR-${label}-${RUN_TOKEN}`],
    );
  } else {
    await rows(
      `insert into public.umkm_profiles
         (user_id, business_name, address, latitude, longitude)
       values ($1, $2, 'Jl. Fixture No. 3', $3, $4)
       on conflict (user_id) do nothing`,
      [id, `HR UMKM ${label} ${RUN_TOKEN}`, FIXTURE_LAT, FIXTURE_LNG],
    );
  }
  return id;
}

/**
 * Restores the subject to a known ladder position. The escalation function
 * classifies the *current* `strike_count` (the caller increments first), so
 * `strikes` here is the number of misses already on record: 1 warns,
 * 2 blocks for seven days, 3 blocks permanently.
 */
async function resetSubject(
  strikes: number,
  status = "active",
  suspendedUntil: string | null = null,
): Promise<void> {
  await rows(`update public.profiles set status = $2 where id = $1`, [subject, status]);
  await rows(
    `update public.umkm_profiles
        set strike_count = $2, suspended_until = $3
      where user_id = $1`,
    [subject, strikes, suspendedUntil],
  );
  await rows(`delete from public.notifications where user_id = $1`, [subject]);
}

const epoch = (value: string | Date | null): number | null =>
  value === null ? null : new Date(value).getTime();

interface WindowSpec {
  registrationOpens: string;
  registrationCloses: string;
  paymentOpens: string;
  paymentCloses: string;
  ready: string;
}

const OPEN_WINDOW: WindowSpec = {
  registrationOpens: "-3 days",
  registrationCloses: "+1 day",
  paymentOpens: "+36 hours",
  paymentCloses: "+2 days",
  ready: "+3 days",
};

const CLOSED_WINDOW: WindowSpec = {
  registrationOpens: "-10 days",
  registrationCloses: "-5 days",
  paymentOpens: "-4 days",
  paymentCloses: "-3 days",
  ready: "-2 days",
};

async function createBatch(key: string): Promise<string> {
  const created = await one<{ id: string }>(
    `insert into public.batches
       (supplier_id, title, description, category, min_quantity,
        pickup_name, pickup_address, latitude, longitude, status)
     values ($1, $2, 'deskripsi fixture', 'sayur', 10,
             'Pickup Fixture', 'Jl. Fixture No. 4', $3, $4, 'published')
     returning id`,
    // Deliberately not prefixed "Fixture ": the supplier-batch-transaction
    // suite tears down with `title like 'Fixture %'`, and vitest runs files in
    // parallel, so a shared prefix lets one suite delete another's rows mid-test.
    [owner, `HitRun ${key} ${RUN_TOKEN}`, FIXTURE_LAT, FIXTURE_LNG],
  );
  const batchId = created.id;
  batchIds.push(batchId);
  await rows(
    `insert into public.batch_tiers (batch_id, tier_number, min_volume, price_per_unit)
     values ($1, 1, 1, 25000)`,
    [batchId],
  );
  return batchId;
}

async function setWindow(batchId: string, w: WindowSpec): Promise<string> {
  const applied = await one<{ payment_closes_at: string }>(
    `insert into public.batch_timeline
       (batch_id, registration_opens_at, registration_closes_at,
        payment_opens_at, payment_closes_at, estimated_ready_at)
     values ($1, now() + $2::interval, now() + $3::interval,
             now() + $4::interval, now() + $5::interval, now() + $6::interval)
     returning payment_closes_at`,
    [
      batchId,
      w.registrationOpens,
      w.registrationCloses,
      w.paymentOpens,
      w.paymentCloses,
      w.ready,
    ],
  );
  return applied.payment_closes_at;
}

async function addRegistration(
  batchId: string,
  umkmId: string,
  status: string,
): Promise<string> {
  const created = await one<{ id: string }>(
    `insert into public.registrations
       (batch_id, umkm_id, quantity, status, final_amount, consented_at,
        locked_tier_number, locked_price_per_unit)
     values ($1, $2, 4, $3, 100000, now(), 1, 25000)
     returning id`,
    [batchId, umkmId, status],
  );
  registrationIds.push(created.id);
  return created.id;
}

/**
 * Builds a batch whose payment window has already closed. The registration
 * trigger rejects inserts once the window shuts, so the fixture is created
 * open and the whole ladder is then aged backwards.
 */
async function agedRegistration(
  key: string,
  umkmId: string,
  status: string,
): Promise<{ batchId: string; registrationId: string; paymentClosesAt: string }> {
  const batchId = await createBatch(key);
  await setWindow(batchId, OPEN_WINDOW);
  const registrationId = await addRegistration(batchId, umkmId, status);
  const aged = await one<{ payment_closes_at: string }>(
    `update public.batch_timeline
        set registration_opens_at = now() + $2::interval,
            registration_closes_at = now() + $3::interval,
            payment_opens_at = now() + $4::interval,
            payment_closes_at = now() + $5::interval,
            estimated_ready_at = now() + $6::interval
      where batch_id = $1
      returning payment_closes_at`,
    [
      batchId,
      CLOSED_WINDOW.registrationOpens,
      CLOSED_WINDOW.registrationCloses,
      CLOSED_WINDOW.paymentOpens,
      CLOSED_WINDOW.paymentCloses,
      CLOSED_WINDOW.ready,
    ],
  );
  return { batchId, registrationId, paymentClosesAt: aged.payment_closes_at };
}

async function addPayment(registrationId: string, status = "pending"): Promise<string> {
  const created = await one<{ id: string }>(
    `insert into public.payments (registration_id, midtrans_order_id, gross_amount, status)
     values ($1, $2, 100000, $3)
     returning id`,
    [registrationId, `HR-${RUN_TOKEN}-${registrationId.slice(0, 8)}`, status],
  );
  return created.id;
}

async function addEscrow(registrationId: string, status = "held"): Promise<void> {
  await rows(
    `insert into public.escrow_holds (registration_id, amount, status)
     values ($1, 100000, $2)`,
    [registrationId, status],
  );
}

interface Sanction {
  status: string;
  strike_count: number;
  suspended_until: string | null;
}

async function sanction(userId: string = subject): Promise<Sanction> {
  return one<Sanction>(
    `select p.status, u.strike_count, u.suspended_until
       from public.profiles p
       join public.umkm_profiles u on u.user_id = p.id
      where p.id = $1`,
    [userId],
  );
}

async function escalations(
  userId: string = subject,
): Promise<Array<{ escalationKey: string; strikeLevel: number | null }>> {
  return rows<{ escalationKey: string; strikeLevel: number | null }>(
    `select data->>'escalationKey'                              as "escalationKey",
            nullif(data->>'strikeLevel', '')::int              as "strikeLevel"
       from public.notifications
      where user_id = $1 and type = 'suspension'
      order by created_at`,
    [userId],
  );
}

async function registrationState(registrationId: string): Promise<{ status: string }> {
  return one<{ status: string }>(
    `select status::text as status from public.registrations where id = $1`,
    [registrationId],
  );
}

describe.skipIf(noDbUrl)("hit-and-run escalation (live Postgres)", () => {
  beforeAll(async () => {
    client = await pool!.connect();
    owner = await createUser("supplier", "supplier");
    subject = await createUser("subject", "umkm");
    other = await createUser("other", "umkm");
  });

  afterAll(async () => {
    if (!client) {
      pool?.end();
      return;
    }
    // Children before parents. payments/disputes/ratings/refund_requests have no
    // ON DELETE CASCADE on registration_id, so registrations cannot be removed
    // until they are gone -- this ordering is the whole point of the list.
    const scoped: Array<[string, string, unknown[]?]> = registrationIds.length
      ? [
          [
            "refund_requests",
            `delete from public.refund_requests where registration_id = any($1::uuid[])`,
            [registrationIds],
          ],
          [
            "disputes",
            `delete from public.disputes where registration_id = any($1::uuid[])`,
            [registrationIds],
          ],
          [
            "ratings",
            `delete from public.ratings where registration_id = any($1::uuid[])`,
            [registrationIds],
          ],
          [
            "supplier_ledger_entries",
            `delete from public.supplier_ledger_entries where registration_id = any($1::uuid[])`,
            [registrationIds],
          ],
          [
            "payment_attempts",
            `delete from public.payment_attempts
              where payment_id in (select id from public.payments
                                     where registration_id = any($1::uuid[]))`,
            [registrationIds],
          ],
          [
            "payments",
            `delete from public.payments where registration_id = any($1::uuid[])`,
            [registrationIds],
          ],
          [
            "escrow_holds",
            `delete from public.escrow_holds where registration_id = any($1::uuid[])`,
            [registrationIds],
          ],
        ]
      : [];

    for (const [label, text, params] of scoped) {
      try {
        await rows(text, params);
      } catch (error) {
        cleanupFailures.push(`${label}: ${(error as Error).message}`);
      }
    }

    if (batchIds.length) {
      for (const [label, text] of [
        ["registrations", `delete from public.registrations where batch_id = any($1::uuid[])`],
        ["batch_tiers", `delete from public.batch_tiers where batch_id = any($1::uuid[])`],
        ["batch_timeline", `delete from public.batch_timeline where batch_id = any($1::uuid[])`],
        ["batches", `delete from public.batches where id = any($1::uuid[])`],
      ] as Array<[string, string]>) {
        try {
          await rows(text, [batchIds]);
        } catch (error) {
          cleanupFailures.push(`${label}: ${(error as Error).message}`);
        }
      }
    }

    for (const [label, text] of [
      ["notifications", `delete from public.notifications where user_id = any($1::uuid[])`],
      ["supplier_profiles", `delete from public.supplier_profiles where user_id = any($1::uuid[])`],
      ["umkm_profiles", `delete from public.umkm_profiles where user_id = any($1::uuid[])`],
      ["profiles", `delete from public.profiles where id = any($1::uuid[])`],
      ["auth.users", `delete from auth.users where id = any($1::uuid[])`],
    ] as Array<[string, string]>) {
      try {
        await rows(text, [userIds]);
      } catch (error) {
        cleanupFailures.push(`${label}: ${(error as Error).message}`);
      }
    }

    client.release();
    await pool!.end();

    // Surface a dirty teardown as a suite failure instead of leaking rows for
    // the next live suite to trip over.
    expect(cleanupFailures, "live teardown must fully remove its fixtures").toEqual([]);
  });

  describe("the strike ladder", () => {
    it("warns at the first missed payment without restricting access", async () => {
      const batchId = await createBatch("ladder-warn");
      const windowClose = await setWindow(batchId, OPEN_WINDOW);
      const registrationId = await addRegistration(batchId, subject, "registered");
      await resetSubject(1);

      await rows(`select public.apply_hit_and_run_escalation($1::uuid, $2::timestamptz, $3::uuid)`, [
        subject,
        windowClose,
        registrationId,
      ]);

      const state = await sanction();
      expect(state.status).toBe("active");
      expect(state.suspended_until).toBeNull();
      // The ladder function only classifies an already-recorded miss; the
      // caller owns the increment, so the count is untouched here.
      expect(state.strike_count).toBe(1);

      const notes = await escalations();
      expect(notes).toHaveLength(1);
      expect(notes[0].strikeLevel).toBe(1);
      expect(notes[0].escalationKey).toContain(registrationId);
    });

    it("blocks the second missed payment for exactly seven days past the window", async () => {
      const batchId = await createBatch("ladder-temp");
      const windowClose = await setWindow(batchId, OPEN_WINDOW);
      const registrationId = await addRegistration(batchId, subject, "registered");
      await resetSubject(2);

      await rows(`select public.apply_hit_and_run_escalation($1::uuid, $2::timestamptz, $3::uuid)`, [
        subject,
        windowClose,
        registrationId,
      ]);

      const state = await sanction();
      expect(state.status).toBe("suspended_temporary");

      // Compared in Postgres so microsecond precision is not lost to JS Dates.
      const check = await one<{ exact: boolean; days: string }>(
        `select u.suspended_until = $2::timestamptz + interval '7 days' as exact,
                extract(epoch from (u.suspended_until - $2::timestamptz)) / 86400.0 as days
           from public.umkm_profiles u
          where u.user_id = $1`,
        [subject, windowClose],
      );
      expect(check.exact, "block must end 7 days after the window deadline").toBe(true);
      expect(Number(check.days)).toBeCloseTo(7, 6);

      const notes = await escalations();
      expect(notes).toHaveLength(1);
      expect(notes[0].strikeLevel).toBe(2);
    });

    it("blocks the third missed payment permanently", async () => {
      const batchId = await createBatch("ladder-perm");
      const windowClose = await setWindow(batchId, OPEN_WINDOW);
      const registrationId = await addRegistration(batchId, subject, "registered");
      await resetSubject(3);

      await rows(`select public.apply_hit_and_run_escalation($1::uuid, $2::timestamptz, $3::uuid)`, [
        subject,
        windowClose,
        registrationId,
      ]);

      const state = await sanction();
      expect(state.status).toBe("suspended_permanent");
      expect(state.suspended_until).toBeNull();

      const notes = await escalations();
      expect(notes).toHaveLength(1);
      expect(notes[0].strikeLevel).toBe(3);
    });

    it("measures the seven days from the deadline, not from the moment of enforcement", async () => {
      // The window closed three days ago, so a block anchored on now() would
      // grant seven more days of selling that the sanction has already spent.
      const { registrationId, paymentClosesAt: windowClose } = await agedRegistration(
        "ladder-retro",
        subject,
        "registered",
      );
      await resetSubject(2);

      await rows(`select public.apply_hit_and_run_escalation($1::uuid, $2::timestamptz, $3::uuid)`, [
        subject,
        windowClose,
        registrationId,
      ]);

      const check = await one<{ inflated: boolean; days_from_now: string }>(
        `select (u.suspended_until = now() + interval '7 days') as inflated,
                extract(epoch from (u.suspended_until - now())) / 86400.0 as days_from_now
           from public.umkm_profiles u
          where u.user_id = $1`,
        [subject],
      );
      expect(check.inflated, "block must not be re-anchored on now()").toBe(false);
      // 7 days from a deadline 3 days past => ~4 days of block remaining.
      expect(Number(check.days_from_now)).toBeGreaterThan(3.9);
      expect(Number(check.days_from_now)).toBeLessThan(4.1);
    });

    it("refuses to sanction without the deadline the block is derived from", async () => {
      const batchId = await createBatch("ladder-null");
      await setWindow(batchId, OPEN_WINDOW);
      const registrationId = await addRegistration(batchId, subject, "registered");
      await resetSubject(2);

      await expect(
        rows(
          `select public.apply_hit_and_run_escalation($1::uuid, null::timestamptz, $2::uuid)`,
          [subject, registrationId],
        ),
      ).rejects.toMatchObject({
        message: expect.stringContaining("payment window closing timestamp is required"),
      });

      const state = await sanction();
      expect(state.status).toBe("active");
      expect(await escalations()).toHaveLength(0);
    });

    it("does not re-notify or extend a block when the same miss is reconciled twice", async () => {
      const batchId = await createBatch("ladder-idem");
      const windowClose = await setWindow(batchId, OPEN_WINDOW);
      const registrationId = await addRegistration(batchId, subject, "registered");
      await resetSubject(2);

      const call = () =>
        rows(
          `select public.apply_hit_and_run_escalation($1::uuid, $2::timestamptz, $3::uuid)`,
          [subject, windowClose, registrationId],
        );

      await call();
      const first = await sanction();
      await call();
      const second = await sanction();

      expect(epoch(second.suspended_until)).toBe(epoch(first.suspended_until));
      expect(second.status).toBe("suspended_temporary");
      expect(await escalations()).toHaveLength(1);
    });
  });

  describe("lifting an expired block", () => {
    it("reactivates a UMKM whose block has run out", async () => {
      await resetSubject(
        2,
        "suspended_temporary",
        new Date(Date.now() - 3_600_000).toISOString(),
      );
      await asCaller(subject);

      const out = await one<{ lifted: boolean }>(
        `select public.lazy_lift_expired_suspension($1::uuid) as lifted`,
        [subject],
      );
      expect(out.lifted).toBe(true);

      const state = await sanction();
      expect(state.status).toBe("active");
      expect(state.suspended_until).toBeNull();
    });

    it("leaves a still-running block alone", async () => {
      const future = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
      await resetSubject(2, "suspended_temporary", future);
      await asCaller(subject);

      const out = await one<{ lifted: boolean }>(
        `select public.lazy_lift_expired_suspension($1::uuid) as lifted`,
        [subject],
      );
      expect(out.lifted).toBe(false);

      const state = await sanction();
      expect(state.status).toBe("suspended_temporary");
      expect(epoch(state.suspended_until)).toBe(epoch(future));
    });

    it("never touches a permanent block", async () => {
      await resetSubject(3, "suspended_permanent", null);
      await asCaller(subject);

      const out = await one<{ lifted: boolean }>(
        `select public.lazy_lift_expired_suspension($1::uuid) as lifted`,
        [subject],
      );
      expect(out.lifted).toBe(false);
      expect((await sanction()).status).toBe("suspended_permanent");
    });

    it("refuses to lift somebody else's block", async () => {
      await resetSubject(
        1,
        "suspended_temporary",
        new Date(Date.now() - 3_600_000).toISOString(),
      );
      await asCaller(other);

      await expect(
        rows(`select public.lazy_lift_expired_suspension($1::uuid)`, [subject]),
      ).rejects.toMatchObject({ message: expect.stringContaining("not allowed") });

      expect((await sanction()).status).toBe("suspended_temporary");
    });
  });

  describe("sanctions driven through the batched materializer", () => {
    it("cancels, expires and warns on a missed payment", async () => {
      const { registrationId } = await agedRegistration("missed-pay", subject, "pending_payment");
      const paymentId = await addPayment(registrationId);
      await resetSubject(0);
      await asCaller(subject);

      const reconciled = await one<{ count: number }>(
        `select public.materialize_umkm_orders(array[$1::uuid]) as count`,
        [registrationId],
      );
      expect(reconciled.count).toBe(1);

      expect((await registrationState(registrationId)).status).toBe("cancelled");
      const payment = await one<{ status: string }>(
        `select status::text as status from public.payments where id = $1`,
        [paymentId],
      );
      expect(payment.status).toBe("expired");

      const state = await sanction();
      expect(state.strike_count).toBe(1);
      expect(state.status).toBe("active");
      const notes = await escalations();
      expect(notes).toHaveLength(1);
      expect(notes[0].strikeLevel).toBe(1);
    });

    it("waits for a live provider attempt before punishing a late payment", async () => {
      const { registrationId } = await agedRegistration("missed-webhook", subject, "pending_payment");
      const paymentId = await addPayment(registrationId);
      await rows(
        `insert into public.payment_attempts
           (payment_id, provider_order_id, idempotency_key, status)
         values ($1, $2, $3, 'pending')`,
        [paymentId, `HR-ATT-${RUN_TOKEN}`, `hr-idem-${RUN_TOKEN}`],
      );
      await resetSubject(0);
      await asCaller(subject);

      await rows(`select public.materialize_umkm_orders(array[$1::uuid])`, [registrationId]);

      // A settlement webhook that is merely late must not be treated as a
      // deliberate no-pay: nothing is cancelled, expired or counted.
      expect((await registrationState(registrationId)).status).toBe("pending_payment");
      const payment = await one<{ status: string }>(
        `select status::text as status from public.payments where id = $1`,
        [paymentId],
      );
      expect(payment.status).toBe("pending");
      const state = await sanction();
      expect(state.strike_count).toBe(0);
      expect(state.status).toBe("active");
      expect(await escalations()).toHaveLength(0);
    });

    it("forfeits escrow on a no-show without counting it as a strike", async () => {
      const { registrationId } = await agedRegistration("no-show", subject, "paid");
      await addPayment(registrationId, "paid");
      await addEscrow(registrationId);
      await resetSubject(0);
      await asCaller(subject);

      await rows(`select public.materialize_umkm_orders(array[$1::uuid])`, [registrationId]);

      expect((await registrationState(registrationId)).status).toBe("no_show");
      const escrow = await one<{ status: string }>(
        `select status::text as status from public.escrow_holds where registration_id = $1`,
        [registrationId],
      );
      expect(escrow.status).toBe("forfeited");

      // Forfeiture is the sanction for a no-show. Escalation is reserved for
      // walking away from paying, so a first-time no-show must not lock the
      // account and count against the next genuine miss.
      const state = await sanction();
      expect(state.strike_count).toBe(0);
      expect(state.status).toBe("active");
      expect(await escalations()).toHaveLength(0);
    });
  });

  describe("the lazy sweep behind the orders page", () => {
    it("escalates a missed payment nobody ever opened the orders page for", async () => {
      const { batchId, registrationId } = await agedRegistration("sweep", subject, "pending_payment");
      const paymentId = await addPayment(registrationId);
      // The sweep counts the miss itself, so one prior miss is what lands this
      // registration on the seven-day line.
      await resetSubject(1);
      // The sweep is driven from the supplier's finance page, so it authorizes
      // the batch owner rather than the UMKM it sanctions.
      await asCaller(owner);

      const summary = await one<{
        doc: { processed: boolean; swept: number; escalated: Record<string, number> };
      }>(`select public.reconcile_batch_payment_window($1::uuid) as doc`, [batchId]);

      expect(summary.doc.processed).toBe(true);
      expect(summary.doc.swept).toBe(1);
      expect(summary.doc.escalated.suspended).toBe(1);
      expect(summary.doc.escalated.warned).toBe(0);
      expect(summary.doc.escalated.permanent).toBe(0);

      expect((await registrationState(registrationId)).status).toBe("cancelled");
      const payment = await one<{ status: string }>(
        `select status::text as status from public.payments where id = $1`,
        [paymentId],
      );
      expect(payment.status).toBe("expired");
      const state = await sanction();
      expect(state.strike_count).toBe(2);
      expect(state.status).toBe("suspended_temporary");
      const notes = await escalations();
      expect(notes).toHaveLength(1);
      expect(notes[0].strikeLevel).toBe(2);
    });
  });
});
