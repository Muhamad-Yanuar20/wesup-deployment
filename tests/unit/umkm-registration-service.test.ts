import { describe, expect, it, vi } from "vitest";
import { registerUmkm, type UmkmRegistrationDependencies } from "@/lib/umkm-registration/service";
import type { UmkmRegistrationFields } from "@/lib/umkm-registration/contracts";

vi.mock("server-only", () => ({}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function fields(): UmkmRegistrationFields {
  return {
    fullName: "Budi Buyer",
    email: " BUDI@EXAMPLE.COM ",
    phone: "081234567890",
    password: "password-123",
    latitude: -6.914744,
    longitude: 107.60981,
  };
}

function dependencies(options: {
  lookup?: { data: Record<string, unknown> | null; error: { message?: string; code?: string } | null };
  signup?: { data: { user: { id: string; identities?: unknown[] } | null; session: unknown }; error: { code?: string; message?: string } | null };
  rpc?: { error: { message?: string; code?: string } | null };
  profile?: { data: Record<string, unknown> | null; error: { message?: string; code?: string } | null };
  umkmProfile?: { data: Record<string, unknown> | null; error: { message?: string; code?: string } | null };
  deleteError?: { message?: string; code?: string } | null;
}) {
  const lookup = vi.fn(async () => options.lookup ?? { data: null, error: null });
  const profile = vi.fn(async () => options.profile ?? { data: { id: USER_ID, role: "umkm" }, error: null });
  const umkmProfile = vi.fn(async () => options.umkmProfile ?? { data: { user_id: USER_ID }, error: null });
  const signUp = vi.fn(async () => options.signup ?? { data: { user: { id: USER_ID, identities: [{}] }, session: null }, error: null });
  const deleteUser = vi.fn(async () => ({ error: options.deleteError ?? null }));
  const rpc = vi.fn(async () => options.rpc ?? { error: null });

  const from = vi.fn((table: "profiles" | "umkm_profiles") => ({
    select: vi.fn((columns: string) => ({
      eq: vi.fn(() => ({
        maybeSingle: table === "profiles" && columns === "id" ? lookup : table === "profiles" ? profile : umkmProfile,
      })),
    })),
  }));

  const deps = {
    authClient: { auth: { signUp } },
    adminClient: {
      auth: { admin: { deleteUser } },
      from,
      rpc,
    },
  } as unknown as UmkmRegistrationDependencies;
  return { deps, lookup, signUp, deleteUser, rpc, profile, umkmProfile };
}

describe("registerUmkm", () => {
  it("creates and verifies profiles plus a location-only UMKM row without returning a session", async () => {
    const mocks = dependencies({ signup: { data: { user: { id: USER_ID, identities: [{}] }, session: { id: "session" } }, error: null } });
    await expect(registerUmkm(fields(), mocks.deps)).resolves.toEqual({ ok: true, requiresEmailConfirmation: false });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "budi@example.com",
      password: "password-123",
      options: { data: { full_name: "Budi Buyer", phone: "081234567890" } },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("create_umkm_registration", {
      p_user_id: USER_ID,
      p_latitude: -6.914744,
      p_longitude: 107.60981,
    });
    expect(mocks.profile).toHaveBeenCalled();
    expect(mocks.umkmProfile).toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rolls back the auth user when the profile RPC fails", async () => {
    const mocks = dependencies({ rpc: { error: { message: "insert failed", code: "42501" } } });
    await expect(registerUmkm(fields(), mocks.deps)).rejects.toMatchObject({ name: "UmkmRegistrationError", stage: "profile_insert" });
    expect(mocks.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("rolls back when the profile rows cannot be verified", async () => {
    const mocks = dependencies({ profile: { data: null, error: null } });
    await expect(registerUmkm(fields(), mocks.deps)).rejects.toMatchObject({ name: "UmkmRegistrationError", stage: "profile_verify" });
    expect(mocks.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("classifies cleanup failures separately", async () => {
    const mocks = dependencies({
      rpc: { error: { message: "insert failed" } },
      deleteError: { message: "delete failed", code: "unexpected" },
    });
    await expect(registerUmkm(fields(), mocks.deps)).rejects.toMatchObject({ name: "UmkmRegistrationError", stage: "cleanup" });
  });

  it("does not create an auth user for duplicate email", async () => {
    const mocks = dependencies({ lookup: { data: { id: "existing" }, error: null } });
    await expect(registerUmkm(fields(), mocks.deps)).rejects.toMatchObject({ name: "DuplicateUmkmEmailError" });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("classifies lookup failures before signup", async () => {
    const mocks = dependencies({ lookup: { data: null, error: { message: "database unavailable" } } });
    await expect(registerUmkm(fields(), mocks.deps)).rejects.toMatchObject({ name: "UmkmRegistrationError", stage: "email_lookup" });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

