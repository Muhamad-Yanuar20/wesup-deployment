import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const noDbUrl = !DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4 })
  : null;

let session: PoolClient | null = null;
let setupError: unknown = null;

let owner = ""; // the approved supplier who owns every fixture batch
let stranger = ""; // a different approved supplier, must be denied
let admin = ""; // admin, allowed by is_admin() but owns nothing
let umkm = ""; // a registered participant for single-registration batches
/**
 * registrations is unique on (batch_id, umkm_id), so a batch holding one row
 * per status needs one distinct UMKM per status.
 */
const umkmPool: string[] = [];

const EMAIL_DOMAIN = "batch-txn.wesup.test";

/**
 * Unique per run. NIK is globally unique, so a fixed value would collide with
 * rows orphaned by an interrupted run; the run token keeps every identity
 * distinct and lets teardown sweep by email pattern.
 */
const RUN_TOKEN = Math.random().toString(36).slice(2, 10);

/**
 * Fixture coordinates, deliberately far from central Bandung. Several batches
 * here have to be published, and the live suite shares one database with a
 * search test that pages published batches inside a 5 km radius of downtown.
 * Parking these outside that radius keeps the two suites from interfering.
 */
const FIXTURE_LAT = -7.351234;
const FIXTURE_LNG = 108.152345;

/** Registration statuses that get_supplier_batch_transaction counts. */
const ALL_STATUSES = [
  "registered",
  "pending_payment",
  "paid",
  "picked_up",
  "completed",
  "cancelled",
  "no_show",
  "refund_pending",
  "refunded",
] as const;

type Capabilities = Record<string, boolean>;

async function createUser(label: string, role: "supplier" | "umkm" | "admin") {
  const slug = label.replace(/\s+/g, "-");
  const email = `${slug}-${RUN_TOKEN}@${EMAIL_DOMAIN}`;
  const { rows } = await session!.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             'authenticated', 'authenticated', $1, 'x')
     returning id`,
    [email],
  );
  const id = rows[0].id as string;
  await session!.query(
    `insert into public.profiles (id, role, status, full_name)
     values ($1, $2, 'active', $3)
     on conflict (id) do update set role = $2, status = 'active'`,
    [id, role, label],
  );
  if (role === "supplier") {
    await session!.query(
      `insert into public.supplier_profiles
         (user_id, business_name, address, latitude, longitude, ktp_photo_url, nik, verification_status)
       values ($1, $2, 'Jl. Fixture No. 1', $3, $4, 'fixture', $5, 'approved')
       on conflict (user_id) do update set verification_status = 'approved'`,
      [id, label, FIXTURE_LAT, FIXTURE_LNG, `NIK-${slug}-${RUN_TOKEN}`],
    );
  }
  if (role === "umkm") {
    await session!.query(
      `insert into public.umkm_profiles (user_id, business_name, address, latitude, longitude)
       values ($1, $2, 'Jl. Fixture No. 3', $3, $4)
       on conflict (user_id) do nothing`,
      [id, label, FIXTURE_LAT, FIXTURE_LNG],
    );
  }
  return id;
}

interface BatchSpec {
  key: string;
  status: "draft" | "published" | "closed";
  minQuantity?: number;
  capacity?: number | null;
  /** Registrations to create while the batch is still published. */
  registrations: Array<{ status: string; quantity: number; amount: number | null }>;
  readyAt?: string | null;
  window?: "open" | "closed";
  withDispute?: boolean;
}

const batches: Record<string, string> = {};

async function createBatch(spec: BatchSpec): Promise<string> {
  const minQuantity = spec.minQuantity ?? 10;
  const windowOpen = (spec.window ?? "open") === "open";

  const { rows } = await session!.query(
    `insert into public.batches
       (supplier_id, title, description, category, min_quantity, capacity_quantity,
        pickup_name, pickup_address, latitude, longitude, status)
     values ($1, $2, 'deskripsi fixture', 'sayur', $3, $4,
             'Pickup Fixture', 'Jl. Fixture No. 4', $5, $6, 'published')
     returning id`,
    [owner, `Fixture ${spec.key}`, minQuantity, spec.capacity ?? null, FIXTURE_LAT, FIXTURE_LNG],
  );
  const batchId = rows[0].id as string;

  await session!.query(
    `insert into public.batch_tiers (batch_id, tier_number, min_volume, price_per_unit)
     values ($1, 1, 1, 25000), ($1, 2, 50, 22000)`,
    [batchId],
  );
  // batch_timeline_linear_order requires all five timestamps to strictly
  // increase, so the closed-window variant shifts the whole ladder backwards
  // rather than only moving registration_closes_at into the past.
  const timeline = windowOpen
    ? {
        registrationOpens: "-3 days",
        registrationCloses: "+1 day",
        paymentOpens: "+36 hours",
        paymentCloses: "+2 days",
        ready: "+3 days",
      }
    : {
        registrationOpens: "-10 days",
        registrationCloses: "-5 days",
        paymentOpens: "-4 days",
        paymentCloses: "-3 days",
        ready: "-2 days",
      };
  await session!.query(
    `insert into public.batch_timeline
       (batch_id, registration_opens_at, registration_closes_at,
        payment_opens_at, payment_closes_at, estimated_ready_at)
     values ($1, now() + $2::interval, now() + $3::interval,
             now() + $4::interval, now() + $5::interval, now() + $6::interval)`,
    [
      batchId,
      timeline.registrationOpens,
      timeline.registrationCloses,
      timeline.paymentOpens,
      timeline.paymentCloses,
      timeline.ready,
    ],
  );

  // The registration trigger only accepts inserts while the batch is published
  // with an open window, so every registration is created here and the batch is
  // moved to its final status afterwards.
  for (const [index, reg] of spec.registrations.entries()) {
    const participant = spec.registrations.length > 1 ? umkmPool[index] : umkm;
    const { rows: inserted } = await session!.query(
      `insert into public.registrations
         (batch_id, umkm_id, quantity, status, final_amount, consented_at, locked_tier_number, locked_price_per_unit)
       values ($1, $2, $3, $4, $5, now(), 1, 25000)
       returning id`,
      [batchId, participant, reg.quantity, reg.status, reg.amount],
    );
    if (spec.withDispute) {
      await session!.query(
        `insert into public.disputes (registration_id, umkm_id, supplier_id, description, status)
         values ($1, $2, $3, 'barang rusak', 'pending')`,
        [inserted[0].id, participant, owner],
      );
    }
  }

  if (spec.readyAt !== undefined) {
    await session!.query(`update public.batches set ready_at = $2 where id = $1`, [
      batchId,
      spec.readyAt ? new Date(Date.now() + 3_600_000).toISOString() : null,
    ]);
  }
  if (spec.status !== "published") {
    await session!.query(`update public.batches set status = $2 where id = $1`, [
      batchId,
      spec.status,
    ]);
  }
  return batchId;
}

async function capabilitiesFor(
  callerId: string,
  batchId: string,
): Promise<{ capabilities: Capabilities; summary: Record<string, unknown>; batch: Record<string, unknown>; orderCount: number }> {
  await session!.query("select set_config('request.jwt.claim.sub', $1, false)", [callerId]);
  const { rows } = await session!.query(
    "select public.get_supplier_batch_transaction($1::uuid) as doc",
    [batchId],
  );
  const doc = rows[0].doc;
  return {
    capabilities: doc.capabilities,
    summary: doc.summary,
    batch: doc.batch,
    orderCount: doc.orders.length,
  };
}

describe.skipIf(noDbUrl)("live get_supplier_batch_transaction contract", () => {
  beforeAll(async () => {
    try {
      session = await pool!.connect();
      owner = await createUser("Txn Owner", "supplier");
      stranger = await createUser("Txn Stranger", "supplier");
      admin = await createUser("Txn Admin", "admin");
      umkm = await createUser("Txn UMKM", "umkm");
      for (let index = 0; index < ALL_STATUSES.length; index += 1) {
        umkmPool.push(await createUser(`Txn UMKM ${index}`, "umkm"));
      }

      // One batch per capability branch, so every flag is exercised.
      batches.draftEmpty = await createBatch({
        key: "draft-empty",
        status: "draft",
        registrations: [],
      });
      batches.publishedAtMin = await createBatch({
        key: "published-at-min",
        status: "published",
        minQuantity: 10,
        registrations: [{ status: "registered", quantity: 10, amount: 250000 }],
      });
      batches.publishedBelowMin = await createBatch({
        key: "published-below-min",
        status: "published",
        minQuantity: 10,
        registrations: [{ status: "registered", quantity: 5, amount: 125000 }],
      });
      batches.publishedWindowClosed = await createBatch({
        key: "published-window-closed",
        status: "published",
        minQuantity: 10,
        window: "closed",
        registrations: [],
      });
      batches.closedNotReady = await createBatch({
        key: "closed-not-ready",
        status: "closed",
        registrations: [],
        readyAt: null,
      });
      batches.closedReady = await createBatch({
        key: "closed-ready",
        status: "closed",
        registrations: [],
        readyAt: "set",
      });
      batches.publishedWithPaid = await createBatch({
        key: "published-with-paid",
        status: "published",
        registrations: [{ status: "paid", quantity: 7, amount: 175000 }],
      });
      batches.publishedWithPickedUp = await createBatch({
        key: "published-with-picked-up",
        status: "published",
        registrations: [{ status: "picked_up", quantity: 3, amount: 75000 }],
      });
      batches.withDispute = await createBatch({
        key: "with-dispute",
        status: "published",
        registrations: [{ status: "picked_up", quantity: 4, amount: 100000 }],
        withDispute: true,
      });
      // A batch whose only registration was cancelled. This is the branch that
      // separates "no registrations at all" from "no live registrations": the
      // old capability check used not exists over every row, so this batch must
      // NOT allow commercial editing even though its participant count is zero.
      batches.cancelledOnly = await createBatch({
        key: "cancelled-only",
        status: "published",
        registrations: [{ status: "cancelled", quantity: 6, amount: 150000 }],
      });
      batches.allStatuses = await createBatch({
        key: "all-statuses",
        status: "published",
        capacity: 1000,
        registrations: ALL_STATUSES.map((status, index) => ({
          status,
          quantity: index + 1,
          amount: (index + 1) * 1000,
        })),
      });
    } catch (error) {
      setupError = error;
    }
  });

  afterAll(async () => {
    if (session) {
      // registrations.batch_id is ON DELETE NO ACTION, so the children have to
      // go first or the batch delete raises a foreign key violation. Delete by
      // pattern rather than by this run's ids so a run interrupted by a failed
      // setup cannot poison the next one.
      for (const statement of [
        `delete from public.disputes where registration_id in (
           select r.id from public.registrations r
             join public.batches b on b.id = r.batch_id
            where b.title like 'Fixture %')`,
        `delete from public.ratings where registration_id in (
           select r.id from public.registrations r
             join public.batches b on b.id = r.batch_id
            where b.title like 'Fixture %')`,
        `delete from public.refund_requests where registration_id in (
           select r.id from public.registrations r
             join public.batches b on b.id = r.batch_id
            where b.title like 'Fixture %')`,
        `delete from public.payments where registration_id in (
           select r.id from public.registrations r
             join public.batches b on b.id = r.batch_id
            where b.title like 'Fixture %')`,
        `delete from public.registrations where batch_id in (
           select id from public.batches where title like 'Fixture %')`,
        `delete from public.batches where title like 'Fixture %'`,
        `delete from public.umkm_profiles where user_id in (
           select id from auth.users where email like '%@${EMAIL_DOMAIN}')`,
        `delete from public.supplier_profiles where user_id in (
           select id from auth.users where email like '%@${EMAIL_DOMAIN}')`,
        `delete from public.profiles where id in (
           select id from auth.users where email like '%@${EMAIL_DOMAIN}')`,
        `delete from auth.users where email like '%@${EMAIL_DOMAIN}'`,
      ]) {
        try {
          await session.query(statement);
        } catch (error) {
          // A leaked fixture poisons later runs, so surface the failure instead
          // of hiding it behind a swallowed rejection.
          console.warn(`teardown failed: ${(error as Error).message}`);
        }
      }
      session.release();
    }
    await pool?.end();
  });

  it("lets the owning supplier edit commercial fields only on an empty draft", async () => {
    if (setupError) throw setupError;
    const draft = await capabilitiesFor(owner, batches.draftEmpty);
    expect(draft.capabilities.canEditCommercialFields).toBe(true);
    expect(draft.capabilities.canCloseBatch).toBe(false);
    expect(draft.capabilities.canCancelBatch).toBe(false);
    expect(draft.capabilities.canMarkReady).toBe(false);
    expect(draft.capabilities.canConfirmPickup).toBe(false);
    expect(draft.capabilities.canViewDispute).toBe(false);
    expect(draft.capabilities.canRequestPayout).toBe(true);

    // Any registration at all removes commercial editing, even on published.
    const published = await capabilitiesFor(owner, batches.publishedAtMin);
    expect(published.capabilities.canEditCommercialFields).toBe(false);
  });

  it("gates canCloseBatch on status, an open window, and the minimum quantity", async () => {
    if (setupError) throw setupError;
    const atMin = await capabilitiesFor(owner, batches.publishedAtMin);
    expect(atMin.capabilities.canCloseBatch).toBe(true);

    const belowMin = await capabilitiesFor(owner, batches.publishedBelowMin);
    expect(belowMin.capabilities.canCloseBatch).toBe(false);

    const windowClosed = await capabilitiesFor(owner, batches.publishedWindowClosed);
    expect(windowClosed.capabilities.canCloseBatch).toBe(false);

    const draft = await capabilitiesFor(owner, batches.draftEmpty);
    expect(draft.capabilities.canCloseBatch).toBe(false);
  });

  it("gates canMarkReady on a closed batch with no ready_at", async () => {
    if (setupError) throw setupError;
    expect((await capabilitiesFor(owner, batches.closedNotReady)).capabilities.canMarkReady).toBe(
      true,
    );
    expect((await capabilitiesFor(owner, batches.closedReady)).capabilities.canMarkReady).toBe(
      false,
    );
  });

  it("gates canConfirmPickup on a paid registration", async () => {
    if (setupError) throw setupError;
    expect(
      (await capabilitiesFor(owner, batches.publishedWithPaid)).capabilities.canConfirmPickup,
    ).toBe(true);
    expect(
      (await capabilitiesFor(owner, batches.publishedWithPickedUp)).capabilities.canConfirmPickup,
    ).toBe(false);
  });

  it("removes canCancelBatch once a registration is picked up or completed", async () => {
    if (setupError) throw setupError;
    expect((await capabilitiesFor(owner, batches.publishedAtMin)).capabilities.canCancelBatch).toBe(
      true,
    );
    expect(
      (await capabilitiesFor(owner, batches.publishedWithPickedUp)).capabilities.canCancelBatch,
    ).toBe(false);
  });

  it("does not allow commercial editing when the only registration was cancelled", async () => {
    if (setupError) throw setupError;
    const only = await capabilitiesFor(owner, batches.cancelledOnly);
    // participant_count excludes cancelled rows, so it is zero here ...
    expect(only.batch.participant_count).toBe(0);
    expect(only.batch.registered_quantity).toBe(0);
    // ... but commercial editing is blocked by the presence of any row.
    expect(only.capabilities.canEditCommercialFields).toBe(false);
    // A cancelled registration also removes the close gate and cancel gate
    // follows the picked_up/completed rule only.
    expect(only.capabilities.canCloseBatch).toBe(false);
    expect(only.capabilities.canCancelBatch).toBe(true);
    expect(only.summary.failed).toBe(1);
    expect(Number(only.summary.totalQuantity)).toBe(6);
  });

  it("reports a dispute on any registration in the batch, and only there", async () => {
    if (setupError) throw setupError;
    expect((await capabilitiesFor(owner, batches.withDispute)).capabilities.canViewDispute).toBe(
      true,
    );
    expect((await capabilitiesFor(owner, batches.publishedAtMin)).capabilities.canViewDispute).toBe(
      false,
    );
  });

  it("summarises every registration status exactly once", async () => {
    if (setupError) throw setupError;
    const { summary, orderCount } = await capabilitiesFor(owner, batches.allStatuses);
    expect(orderCount).toBe(ALL_STATUSES.length);
    expect(summary.registered).toBe(1);
    expect(summary.pendingPayment).toBe(1);
    expect(summary.paid).toBe(1);
    // picked_up and completed both roll into pickedUp.
    expect(summary.pickedUp).toBe(2);
    // cancelled and no_show both roll into failed.
    expect(summary.failed).toBe(2);
    // refund_pending and refunded both roll into refund.
    expect(summary.refund).toBe(2);
    // 1..9 summed.
    expect(Number(summary.totalQuantity)).toBe(45);
    expect(Number(summary.totalAmount)).toBe(45000);
  });

  it("excludes cancelled registrations from the batch quantity and participant count", async () => {
    if (setupError) throw setupError;
    const { batch } = await capabilitiesFor(owner, batches.allStatuses);
    const quantities = ALL_STATUSES.map((_, index) => index + 1);
    const withoutCancelled = quantities.reduce((sum, q, index) =>
      ALL_STATUSES[index] === "cancelled" ? sum : sum + q, 0);
    expect(Number(batch.registered_quantity)).toBe(withoutCancelled);
    expect(Number(batch.participant_count)).toBe(ALL_STATUSES.length - 1);
    expect(Number(batch.paid_participant_count)).toBe(3); // paid, picked_up, completed
  });

  it("returns the batch scalar fields on the document instead of dropping them", async () => {
    if (setupError) throw setupError;
    const { batch } = await capabilitiesFor(owner, batches.publishedAtMin);
    expect(batch.min_quantity).toBe(10);
    expect(batch.status).toBe("published");
    expect(Array.isArray(batch.tiers)).toBe(true);
    expect((batch.tiers as unknown[]).length).toBe(2);
    expect(batch).toHaveProperty("registration_closed_at");
    expect(batch).toHaveProperty("close_reason");
    expect(batch).toHaveProperty("final_registered_quantity");
    expect(batch).toHaveProperty("locked_tier_number");
    expect(batch).toHaveProperty("locked_unit_price");
    expect(batch).toHaveProperty("invoices_issued_at");
    expect(batch).toHaveProperty("ready_at");
    expect(batch).toHaveProperty("completed_at");
    expect(batch).toHaveProperty("payment_window_hours");
  });

  it("mirrors the ten duplicated scalars at the top level and in the batch", async () => {
    if (setupError) throw setupError;
    // The old body fetched these ten columns a second time with scalar
    // subqueries purely to repeat them at the top level. They must stay present,
    // correctly typed, and identical to the batch document's copy.
    for (const batchId of [batches.publishedAtMin, batches.closedReady, batches.draftEmpty]) {
      await session!.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
      const { rows } = await session!.query(
        "select public.get_supplier_batch_transaction($1::uuid) as doc",
        [batchId],
      );
      const doc = rows[0].doc;
      const pairs: Array<[string, string]> = [
        ["capacityQuantity", "capacity_quantity"],
        ["paymentWindowHours", "payment_window_hours"],
        ["registrationClosedAt", "registration_closed_at"],
        ["closeReason", "close_reason"],
        ["finalRegisteredQuantity", "final_registered_quantity"],
        ["lockedTierNumber", "locked_tier_number"],
        ["lockedUnitPrice", "locked_unit_price"],
        ["invoicesIssuedAt", "invoices_issued_at"],
        ["readyAt", "ready_at"],
        ["completedAt", "completed_at"],
      ];
      for (const [topLevel, nested] of pairs) {
        expect(doc).toHaveProperty(topLevel);
        expect(doc.batch).toHaveProperty(nested);
        // jsonb round-trips both through to_jsonb, so compare the encoded form.
        expect(JSON.stringify(doc[topLevel])).toBe(JSON.stringify(doc.batch[nested]));
      }
    }
  });

  it("grants an admin reconciliation access with no owner-only capabilities", async () => {
    if (setupError) throw setupError;
    const asAdmin = await capabilitiesFor(admin, batches.publishedAtMin);
    expect(asAdmin.capabilities.canEditCommercialFields).toBe(false);
    expect(asAdmin.capabilities.canCloseBatch).toBe(false);
    expect(asAdmin.capabilities.canCancelBatch).toBe(false);
    expect(asAdmin.capabilities.canMarkReady).toBe(false);
    expect(asAdmin.capabilities.canConfirmPickup).toBe(false);
    expect(asAdmin.capabilities.canRequestPayout).toBe(false);
    // Dispute visibility is not owner-gated.
    expect(
      (await capabilitiesFor(admin, batches.withDispute)).capabilities.canViewDispute,
    ).toBe(true);
  });

  it("refuses a supplier who does not own the batch", async () => {
    if (setupError) throw setupError;
    await session!.query("select set_config('request.jwt.claim.sub', $1, false)", [stranger]);
    await expect(
      session!.query("select public.get_supplier_batch_transaction($1::uuid)", [
        batches.publishedAtMin,
      ]),
    ).rejects.toThrow(/batch access denied/i);
  });

  it("raises for a batch that does not exist", async () => {
    if (setupError) throw setupError;
    await session!.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await expect(
      session!.query("select public.get_supplier_batch_transaction(gen_random_uuid())"),
    ).rejects.toThrow(/batch not found/i);
  });
});
