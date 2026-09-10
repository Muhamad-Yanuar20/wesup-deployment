import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const noConfig = !SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY;

const describeLive = describe.skipIf(noConfig);

describeLive("live UMKM registration", () => {
  it("creates one linked profiles and umkm_profiles row and is idempotent", async () => {
    const email = `umkm-rpc-${Math.random().toString(36).slice(2, 12)}@example.com`;
    const password = "umkm-rpc-test-password";
    const latitude = -6.914744;
    const longitude = 107.60981;
    const publicClient = createClient<Database>(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const adminClient = createClient<Database>(SUPABASE_URL!, SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let userId: string | undefined;

    try {
      const signup = await publicClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: "UMKM RPC Test", phone: "081234567890" } },
      });
      expect(signup.error).toBeNull();
      expect(signup.data.user).not.toBeNull();
      userId = signup.data.user?.id;
      expect(userId).toBeTruthy();

      const first = await adminClient.rpc("create_umkm_registration", {
        p_user_id: userId!,
        p_latitude: latitude,
        p_longitude: longitude,
      });
      expect(first.error).toBeNull();

      const retry = await adminClient.rpc("create_umkm_registration", {
        p_user_id: userId!,
        p_latitude: latitude,
        p_longitude: longitude,
      });
      expect(retry.error).toBeNull();

      const profile = await adminClient
        .from("profiles")
        .select("id,role,status")
        .eq("id", userId!);
      expect(profile.error).toBeNull();
      expect(profile.data).toEqual([{ id: userId, role: "umkm", status: "active" }]);

      const umkm = await adminClient
        .from("umkm_profiles")
        .select("user_id,latitude,longitude")
        .eq("user_id", userId!);
      expect(umkm.error).toBeNull();
      expect(umkm.data).toHaveLength(1);
      expect(umkm.data?.[0]).toMatchObject({ user_id: userId, latitude, longitude });
    } finally {
      if (userId) await adminClient.auth.admin.deleteUser(userId);
    }
  });

  it("rejects non-UMKM, inactive, and out-of-service profiles", async () => {
    const email = `umkm-rpc-guard-${Math.random().toString(36).slice(2, 12)}@example.com`;
    const publicClient = createClient<Database>(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const adminClient = createClient<Database>(SUPABASE_URL!, SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let userId: string | undefined;

    try {
      const signup = await publicClient.auth.signUp({
        email,
        password: "umkm-rpc-guard-password",
        options: { data: { full_name: "UMKM Guard Test", phone: "081234567890" } },
      });
      expect(signup.error).toBeNull();
      userId = signup.data.user?.id;
      expect(userId).toBeTruthy();

      const supplierUpdate = await adminClient
        .from("profiles")
        .update({ role: "supplier" })
        .eq("id", userId!);
      expect(supplierUpdate.error).toBeNull();
      const supplierResult = await adminClient.rpc("create_umkm_registration", {
        p_user_id: userId!,
        p_latitude: -6.914744,
        p_longitude: 107.60981,
      });
      expect(supplierResult.error?.code).toBe("42501");

      const inactiveUpdate = await adminClient
        .from("profiles")
        .update({ role: "umkm", status: "banned" })
        .eq("id", userId!);
      expect(inactiveUpdate.error).toBeNull();
      const inactiveResult = await adminClient.rpc("create_umkm_registration", {
        p_user_id: userId!,
        p_latitude: -6.914744,
        p_longitude: 107.60981,
      });
      expect(inactiveResult.error?.code).toBe("42501");

      const activeUpdate = await adminClient
        .from("profiles")
        .update({ role: "umkm", status: "active" })
        .eq("id", userId!);
      expect(activeUpdate.error).toBeNull();
      const locationResult = await adminClient.rpc("create_umkm_registration", {
        p_user_id: userId!,
        p_latitude: 0,
        p_longitude: 0,
      });
      expect(locationResult.error?.code).toBe("22023");
    } finally {
      if (userId) await adminClient.auth.admin.deleteUser(userId);
    }
  });
  it("rejects an RPC call for an unknown profile without auth.users permission failure", async () => {
    const adminClient = createClient<Database>(SUPABASE_URL!, SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const result = await adminClient.rpc("create_umkm_registration", {
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_latitude: -6.914744,
      p_longitude: 107.60981,
    });
    expect(result.error?.code).toBe("P0001");
    expect(result.error?.message).toContain("profile does not exist");
  });
});
