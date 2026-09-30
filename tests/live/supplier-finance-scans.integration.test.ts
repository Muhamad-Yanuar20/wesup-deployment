import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const noDbUrl = !DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4 })
  : null;

/**
 * The same four totals get_supplier_finance used to compute with four separate
 * scalar subqueries, written the way any other query would: a single grouped
 * pass. If the consolidated function ever disagrees with this, the money view
 * is wrong and this test should fail.
 */
async function independentBalances(client: PoolClient, supplierId: string) {
  const { rows } = await client.query(
    `select
       coalesce(sum(amount) filter (where to_bucket = 'escrow'), 0) as escrow,
       coalesce(sum(amount) filter (where to_bucket = 'frozen'), 0) as frozen,
       coalesce(sum(case when to_bucket = 'available' then amount else 0 end), 0)
         - coalesce(sum(case when from_bucket = 'available' then amount else 0 end), 0) as available,
       coalesce(sum(amount) filter (where to_bucket = 'paid_out'), 0) as paid_out
     from public.supplier_ledger_entries
     where supplier_id = $1`,
    [supplierId],
  );
  return rows[0];
}

let session: PoolClient | null = null;
let setupError: unknown = null;
let supplierId = "";
let emptySupplierId = "";

const EMAIL_SUFFIX = "@finance-scans.wesup.test";

// Synthetic suppliers we own end to end, so the ledger contents are known.
const LEDGER: Array<{ from: string | null; to: string | null; amount: string; key: string }> = [
  { from: null, to: "escrow", amount: "100000.00", key: "fin-a-escrow" },
  { from: null, to: "frozen", amount: "25000.50", key: "fin-a-frozen" },
  { from: "escrow", to: "available", amount: "40000.00", key: "fin-a-release" },
  { from: "available", to: "paid_out", amount: "15000.00", key: "fin-a-payout" },
];

async function createSupplier(label: string): Promise<string> {
  const email = `${label}-${Math.random().toString(36).slice(2, 10)}${EMAIL_SUFFIX}`;
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
     values ($1, 'supplier', 'active', $2)
     on conflict (id) do update set role = 'supplier', status = 'active'`,
    [id, label],
  );
  await session!.query(
    `insert into public.supplier_profiles
       (user_id, business_name, address, latitude, longitude, ktp_photo_url, nik, verification_status)
     values ($1, $2, 'Jl. Test No. 1', -6.914744, 107.60981, 'fixture', $3, 'approved')
     on conflict (user_id) do update set verification_status = 'approved'`,
    [id, label, `NIK-${label.replace(/\s+/g, "-")}`],
  );
  return id;
}

describe.skipIf(noDbUrl)("live get_supplier_finance scan consolidation", () => {
  beforeAll(async () => {
    try {
      session = await pool!.connect();
      supplierId = await createSupplier("Finance Scan Fixture");
      emptySupplierId = await createSupplier("Empty Ledger Fixture");

      for (const entry of LEDGER) {
        await session.query(
          `insert into public.supplier_ledger_entries
             (supplier_id, from_bucket, to_bucket, amount, entry_type, idempotency_key)
           values ($1, $2, $3, $4, 'test', $5)
           on conflict (idempotency_key) do nothing`,
          [supplierId, entry.from, entry.to, entry.amount, entry.key],
        );
      }
      // auth.uid() is what the function binds v_supplier_id to.
      await session.query("select set_config('request.jwt.claim.sub', $1, false)", [supplierId]);
    } catch (error) {
      setupError = error;
    }
  });

  afterAll(async () => {
    const failures: string[] = [];
    if (session) {
      const ids = [supplierId, emptySupplierId].filter((id): id is string => Boolean(id));
      // Swallowing a teardown failure hides a leak that the next live suite then
      // trips over, so each statement is checked and reported at the end.
      for (const [label, text] of [
        ["supplier_ledger_entries", `delete from public.supplier_ledger_entries where supplier_id = any($1::uuid[])`],
        ["auth.users", `delete from auth.users where id = any($1::uuid[])`],
      ] as Array<[string, string]>) {
        try {
          await session.query(text, [ids]);
        } catch (error) {
          failures.push(`${label}: ${(error as Error).message}`);
        }
      }
      session.release();
    }
    await pool?.end();
    expect(failures, "live teardown must fully remove its fixtures").toEqual([]);
  });

  it("agrees with an independently computed grouped aggregate", async () => {
    if (setupError) throw setupError;
    const { rows } = await session!.query("select public.get_supplier_finance() as doc");
    const balances = rows[0].doc.balances;
    const expected = await independentBalances(session!, supplierId);

    expect(Number(balances.escrow)).toBe(Number(expected.escrow));
    expect(Number(balances.frozen)).toBe(Number(expected.frozen));
    expect(Number(balances.available)).toBe(Number(expected.available));
    expect(Number(balances.paidOut)).toBe(Number(expected.paid_out));
  });

  it("returns the expected totals for a known ledger", async () => {
    if (setupError) throw setupError;
    const { rows } = await session!.query("select public.get_supplier_finance() as doc");
    expect(Number(rows[0].doc.balances.escrow)).toBe(100000);
    expect(Number(rows[0].doc.balances.frozen)).toBe(25000.5);
    // 40000 released into available, 15000 of it paid out.
    expect(Number(rows[0].doc.balances.available)).toBe(25000);
    expect(Number(rows[0].doc.balances.paidOut)).toBe(15000);
  });

  it("keeps the response shape and the remaining keys", async () => {
    if (setupError) throw setupError;
    const { rows } = await session!.query("select public.get_supplier_finance() as doc");
    const doc = rows[0].doc;
    expect(Object.keys(doc).sort()).toEqual(
      ["accounts", "balances", "payouts", "serverTime"].sort(),
    );
    expect(Object.keys(doc.balances).sort()).toEqual(
      ["available", "escrow", "frozen", "paidOut"].sort(),
    );
    expect(Array.isArray(doc.accounts)).toBe(true);
    expect(Array.isArray(doc.payouts)).toBe(true);
  });

  it("returns zero balances for a supplier with no ledger entries", async () => {
    if (setupError) throw setupError;
    await session!.query("select set_config('request.jwt.claim.sub', $1, false)", [
      emptySupplierId,
    ]);
    const { rows } = await session!.query("select public.get_supplier_finance() as doc");
    const balances = rows[0].doc.balances;

    // The zero-ledger case is the one place the old coalesce() placement
    // mattered, so it is asserted explicitly.
    expect(Number(balances.escrow)).toBe(0);
    expect(Number(balances.frozen)).toBe(0);
    expect(Number(balances.available)).toBe(0);
    expect(Number(balances.paidOut)).toBe(0);

    await session!.query("select set_config('request.jwt.claim.sub', $1, false)", [supplierId]);
  });
});
