import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const noDbUrl = !DATABASE_URL;
const noRestUrl = !SUPABASE_URL || !PUBLISHABLE_KEY;

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

interface SignUpResult {
  email: string;
  uid: string;
  session: { uid: string; accessToken: string } | null;
}

async function trySignUp(): Promise<SignUpResult | null> {
  if (noDbUrl || noRestUrl) return null;
  const email = `rls-${Math.random().toString(36).slice(2, 10)}@example.com`;
  const password = "rls-test-password";
  const supabase = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!);
  const { data } = await supabase.auth.signUp({ email, password });
  if (!data.user) return null;
  let session = data.session;
  if (!session) {
    const res = await supabase.auth.signInWithPassword({ email, password });
    session = res.data.session ?? null;
  }
  return {
    email,
    uid: session?.user.id ?? data.user.id,
    session: session
      ? { uid: session.user.id, accessToken: session.access_token }
      : null,
  };
}

const signUpResult = await trySignUp();
const freshUser = await trySignUp();

describe.skipIf(noDbUrl || noRestUrl)("live auth & RLS hardening", () => {
  const emails: string[] = [signUpResult, freshUser]
    .filter((r): r is SignUpResult => r !== null)
    .map((r) => r.email);

  afterAll(async () => {
    if (pool && emails.length > 0) {
      await pool.query("delete from auth.users where email = any($1::text[])", [
        emails,
      ]);
    }
    await pool?.end();
  });

  describe.skipIf(!signUpResult?.session)("authenticated role separation", () => {
    if (!signUpResult?.session) return;
    const session = signUpResult.session;
    const uid = session.uid;
    const accessToken = session.accessToken;

    async function rest(path: string, init: RequestInit = {}): Promise<Response> {
      return fetch(`${SUPABASE_URL}${path}`, {
        ...init,
        headers: {
          apikey: PUBLISHABLE_KEY!,
          Authorization: `Bearer ${accessToken}`,
          ...init.headers,
        },
      });
    }

    function getProfiles(query: string): Promise<Response> {
      return rest(`/rest/v1/profiles${query}`);
    }

    function patchProfile(body: Record<string, unknown>): Promise<Response> {
      return rest(`/rest/v1/profiles?id=eq.${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });
    }

    function postSupplierProfile(body: Record<string, unknown>): Promise<Response> {
      return rest("/rest/v1/supplier_profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }

    function patchSupplierProfile(body: Record<string, unknown>): Promise<Response> {
      return rest(`/rest/v1/supplier_profiles?user_id=eq.${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });
    }

    function supplierPayload(): Record<string, unknown> {
      return {
        user_id: uid,
        business_name: "RLS Test Supplier",
        address: "Test Address",
        latitude: 1,
        longitude: 1,
        nik: `rls-${Math.random().toString(36).slice(2, 14)}`,
        ktp_photo_url: "https://example.com/ktp.jpg",
      };
    }

    it("blocks role escalation via REST PATCH", async () => {
      const res = await patchProfile({ role: "admin" });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("allows own full_name update and persists it", async () => {
      const res = await patchProfile({ full_name: "Updated" });
      expect(res.status).toBeLessThan(300);
      const get = await getProfiles(`?id=eq.${uid}&select=full_name`);
      const body = (await get.json()) as Array<{ full_name: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].full_name).toBe("Updated");
    });

    it("allows own KYC submission via REST POST", async () => {
      const res = await postSupplierProfile(supplierPayload());
      expect(res.status).toBe(201);
    });

    it("blocks self-approval via REST POST with verification_status", async () => {
      const res = await postSupplierProfile({
        ...supplierPayload(),
        verification_status: "approved",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("blocks self-approval via REST PATCH of verification_status", async () => {
      const res = await patchSupplierProfile({ verification_status: "approved" });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("allows legitimate KYC editing via REST PATCH", async () => {
      const res = await patchSupplierProfile({ business_name: "RLS Test Supplier 2" });
      expect(res.status).toBeLessThan(300);
    });

    it("rejects UMKM registration RPC for authenticated users", async () => {
      const res = await rest("/rest/v1/rpc/create_umkm_registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_user_id: uid,
          p_latitude: -6.914744,
          p_longitude: 107.60981,
        }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
    it("rejects approve_supplier rpc for non-admin", async () => {
      const res = await rest("/rest/v1/rpc/approve_supplier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_user_id: uid }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("blocks non-admin INSERT into admin_audit_logs (no insert policy)", async () => {
      const res = await rest("/rest/v1/admin_audit_logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          admin_id: uid,
          action_type: "ban_user",
          target_type: "profiles",
          target_id: uid,
        }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("keeps umkm_bank_accounts owner-readable without direct writes", async () => {
      await pool!.query(
        `insert into public.umkm_bank_accounts (umkm_id, bank_name, account_number, account_holder_name)
         values ($1, 'Test Bank', '1234567890', 'Rls Tester')`,
        [uid],
      );
      const select = await rest("/rest/v1/umkm_bank_accounts?umkm_id=eq." + uid + "&select=id,bank_name");
      expect(select.status).toBe(200);
      const rows = (await select.json()) as Array<{ id: string; bank_name: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].bank_name).toBe("Test Bank");

      const insert = await rest("/rest/v1/umkm_bank_accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ umkm_id: uid, bank_name: "Test Bank 2", account_number: "0987654321", account_holder_name: "Rls Tester" }),
      });
      expect(insert.status).toBeGreaterThanOrEqual(400);

      const update = await rest("/rest/v1/umkm_bank_accounts?umkm_id=eq." + uid, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ bank_name: "Mutated" }),
      });
      // RLS-filtered PATCHes match zero rows and still answer 204; the
      // meaningful assertion is that the stored value is untouched.
      expect(update.status).toBeLessThan(500);
      const after = await rest("/rest/v1/umkm_bank_accounts?umkm_id=eq." + uid + "&select=bank_name");
      const afterRows = (await after.json()) as Array<{ bank_name: string }>;
      expect(afterRows).toHaveLength(1);
      expect(afterRows[0].bank_name).toBe("Test Bank");
    });

    it("keeps supplier_bank_accounts owner-readable only for approved suppliers", async () => {
      await pool!.query(
        `insert into public.supplier_bank_accounts (supplier_id, bank_name, account_number, account_holder_name, is_primary)
         values ($1, 'Test Bank', '4567890123', 'Rls Tester', true)`,
        [uid],
      );
      const select = await rest("/rest/v1/supplier_bank_accounts?supplier_id=eq." + uid + "&select=id");
      expect(select.status).toBe(200);
      const rows = (await select.json()) as Array<{ id: string }>;
      expect(rows).toHaveLength(0);

      const update = await rest("/rest/v1/supplier_bank_accounts?supplier_id=eq." + uid, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ bank_name: "Mutated" }),
      });
      // Non-approved suppliers match zero rows under RLS (204 no-op).
      expect(update.status).toBeLessThan(500);
      const after = await rest("/rest/v1/supplier_bank_accounts?supplier_id=eq." + uid + "&select=bank_name");
      expect(((await after.json()) as unknown[])).toHaveLength(0);
    });

    it.skipIf(!freshUser?.uid)(
      "does not promote a fresh UMKM when supplier profile is approved",
      async () => {
        const nik = `rls-${Math.random().toString(36).slice(2, 14)}`;
        await pool!.query(
          `insert into public.supplier_profiles
             (user_id, business_name, address, latitude, longitude, nik, ktp_photo_url, verification_status)
           values ($1, 'RLS Test Supplier', 'Test Address', 1, 1, $2, 'https://example.com/ktp.jpg', 'approved')`,
          [freshUser!.uid, nik],
        );
        const res = await pool!.query<{ role: string }>(
          "select role from public.profiles where id = $1",
          [freshUser!.uid],
        );
        expect(res.rows).toHaveLength(1);
        // Supplier identity is assigned during supplier registration.
        // Approval changes capability only and must never promote an existing UMKM.
        expect(res.rows[0].role).toBe("umkm");
      },
    );

    it("shows only own row once banned (is_admin requires active)", async () => {
      await pool!.query(
        "update public.profiles set role = 'admin', status = 'banned' where id = $1",
        [uid],
      );
      const res = await getProfiles("?select=id");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{ id: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(uid);
    });
  });
});
