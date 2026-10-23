import { describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET, PUT } from "@/app/api/umkm/profile/route";

// Replace only Next's cookie adapter. Auth and mutations use a real signed-in
// publishable-key client through PostgREST, with the deployed column grants.
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeLive = describe.skipIf(!url || !publicKey || !secretKey);
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const profilePayload = {
  businessName: "Zahir Hopper",
  address: "Tempore aliqua III",
  latitude: -6.99236,
  longitude: 107.60102,
};

function save(body: typeof profilePayload) {
  return PUT(new Request("http://localhost/api/umkm/profile", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

async function withUmkm(run: (fixture: {
  userId: string;
  client: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
}) => Promise<void>) {
  const admin = createClient<Database>(url!, secretKey!, clientOptions);
  const client = createClient<Database>(url!, publicKey!, clientOptions);
  const email = `umkm-profile-save-${crypto.randomUUID()}@example.com`;
  const password = `Profile-test-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;

  try {
    const signedIn = await client.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    expect(signedIn.data.session).not.toBeNull();
    vi.mocked(getServerClient).mockResolvedValue(client);
    await run({ userId, client, admin });
  } finally {
    vi.mocked(getServerClient).mockReset();
    const deleted = await admin.auth.admin.deleteUser(userId);
    expect(deleted.error).toBeNull();
  }
}

describeLive("live UMKM profile save with column-scoped privileges", () => {
  it("completes registration, persists edits, and keeps identity and penalties protected", async () => {
    await withUmkm(async ({ userId, client, admin }) => {
      const registered = await admin.rpc("create_umkm_registration", {
        p_user_id: userId, p_latitude: profilePayload.latitude, p_longitude: profilePayload.longitude,
      });
      expect(registered.error).toBeNull();
      const seeded = await admin.from("umkm_profiles").update({ strike_count: 2 }).eq("user_id", userId);
      expect(seeded.error).toBeNull();

      const response = await save(profilePayload);
      const body = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(200);
      expect(body.profile).toMatchObject({ ...profilePayload, userId, strikeCount: 2 });

      const reloaded = await GET();
      expect(reloaded.status).toBe(200);
      expect((await reloaded.json()).profile).toMatchObject({ ...profilePayload, userId });

      const edited = { businessName: "Warung Profil Baru", address: "Jl. Braga No. 10", latitude: -6.914744, longitude: 107.60981 };
      const update = await save(edited);
      expect(update.status).toBe(200);
      expect((await (await GET()).json()).profile).toMatchObject({ ...edited, userId, strikeCount: 2 });

      for (const forbidden of [{ strike_count: 0 }, { suspended_until: "2099-01-01T00:00:00Z" }, { user_id: userId }]) {
        const denied = await client.from("umkm_profiles").update(forbidden).eq("user_id", userId);
        expect(denied.error?.code).toBe("42501");
      }
      const stored = await client.from("umkm_profiles")
        .select("user_id,business_name,address,latitude,longitude,strike_count,suspended_until")
        .eq("user_id", userId).single();
      expect(stored.error).toBeNull();
      expect(stored.data).toEqual({
        user_id: userId, business_name: "Warung Profil Baru", address: "Jl. Braga No. 10",
        latitude: -6.914744, longitude: 107.60981, strike_count: 2, suspended_until: null,
      });
    });
  });

  it("creates a missing profile and leaves one stored row after concurrent saves", async () => {
    await withUmkm(async ({ userId, client, admin }) => {
      // Guarantee the recovery case even if signup later starts creating rows.
      const cleared = await admin.from("umkm_profiles").delete().eq("user_id", userId);
      expect(cleared.error).toBeNull();
      const initial = await GET();
      expect(initial.status).toBe(200);
      expect(await initial.json()).toEqual({ profile: null });

      const responses = await Promise.all([save(profilePayload), save(profilePayload)]);
      for (const response of responses) {
        const body = await response.json();
        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body.profile).toMatchObject({ ...profilePayload, userId });
      }
      const stored = await client.from("umkm_profiles").select("user_id,business_name,address,latitude,longitude").eq("user_id", userId);
      expect(stored.error).toBeNull();
      expect(stored.data).toEqual([{
        user_id: userId, business_name: "Zahir Hopper", address: "Tempore aliqua III",
        latitude: -6.99236, longitude: 107.60102,
      }]);
    });
  });
});
