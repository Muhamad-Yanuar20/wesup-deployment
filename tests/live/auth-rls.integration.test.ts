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
    session: session
      ? { uid: session.user.id, accessToken: session.access_token }
      : null,
  };
}

const signUpResult = await trySignUp();

describe.skipIf(noDbUrl || noRestUrl)("live auth & RLS hardening", () => {
  const emails: string[] = signUpResult ? [signUpResult.email] : [];

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
    const restUrl = `${SUPABASE_URL}/rest/v1/profiles`;

    async function getProfiles(query: string): Promise<Response> {
      return fetch(`${restUrl}${query}`, {
        headers: {
          apikey: PUBLISHABLE_KEY!,
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }

    async function patchProfile(body: Record<string, unknown>): Promise<Response> {
      return fetch(`${restUrl}?id=eq.${uid}`, {
        method: "PATCH",
        headers: {
          apikey: PUBLISHABLE_KEY!,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });
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

    it("promotes profile to supplier when supplier profile is approved", async () => {
      const nik = `rls-${Math.random().toString(36).slice(2, 14)}`;
      await pool!.query(
        `insert into public.supplier_profiles
           (user_id, business_name, address, latitude, longitude, nik, ktp_photo_url, verification_status)
         values ($1, 'RLS Test Supplier', 'Test Address', 1, 1, $2, 'https://example.com/ktp.jpg', 'approved')`,
        [uid, nik],
      );
      const res = await pool!.query<{ role: string }>(
        "select role from public.profiles where id = $1",
        [uid],
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].role).toBe("supplier");
    });

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
