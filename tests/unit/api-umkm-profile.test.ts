import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountStatus, Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET, PUT } from "@/app/api/umkm/profile/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);
const payload = { businessName: "Warung Rina", address: "Jl. Braga", latitude: -6.914744, longitude: 107.60981 };
const savedProfile = {
  user_id: "umkm-1", business_name: "Warung Rina", address: "Jl. Braga",
  latitude: -6.914744, longitude: 107.60981, strike_count: 2, suspended_until: null,
};
interface WriteResult {
  data: Record<string, unknown> | null;
  error: { message?: string; code?: string } | null;
}
const saved: WriteResult = { data: savedProfile, error: null };
const missing: WriteResult = { data: null, error: null };
const denied: WriteResult = { data: null, error: { message: "permission denied for table umkm_profiles", code: "42501" } };

function makeClient(options: {
  user?: { id: string; email: string } | null;
  role?: "umkm" | "supplier" | "admin";
  status?: AccountStatus;
  profile?: Record<string, unknown> | null;
  updateResults?: WriteResult[];
  insertResult?: WriteResult;
} = {}) {
  const updateResults = [...(options.updateResults ?? [saved])];
  const updatedRow = vi.fn(async () => updateResults.shift() ?? missing);
  const updateFilter = vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: updatedRow })) }));
  const update = vi.fn(() => ({ eq: updateFilter }));
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({ single: vi.fn(async () => options.insertResult ?? saved) })),
  }));
  // PostgREST's merge upsert also assigns the protected user_id column.
  const upsert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => denied) })) }));
  const client = {
    auth: { getUser: vi.fn(async () => ({
      data: { user: options.user === undefined ? { id: "umkm-1", email: "rina@example.com" } : options.user },
      error: null,
    })) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { role: options.role ?? "umkm", status: options.status ?? "active", full_name: "Rina" },
            error: null,
          })),
        })) })) };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: options.profile ?? null, error: null })),
        })) })),
        update, insert, upsert,
      };
    }),
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, update, updateFilter, insert };
}

function jsonRequest(body: unknown = payload) {
  return new Request("http://localhost/api/umkm/profile", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("UMKM profile API", () => {
  beforeEach(() => mockGetServerClient.mockReset());

  it("returns an empty profile for a browsing UMKM without forcing onboarding", async () => {
    makeClient({ profile: null });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ profile: null });
  });

  it("completes a location-only registration without writing protected columns", async () => {
    const { update, updateFilter, insert } = makeClient({
      profile: { user_id: "umkm-1", business_name: null, address: null, latitude: -6.914744, longitude: 107.60981 },
    });
    const response = await PUT(jsonRequest({
      ...payload, businessName: " Warung Rina ", address: " Jl. Braga ",
      user_id: "another-user", strike_count: 0, suspended_until: "2099-01-01T00:00:00Z", created_at: "2000-01-01T00:00:00Z",
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ profile: {
      userId: "umkm-1", businessName: "Warung Rina", address: "Jl. Braga", strikeCount: 2,
    } });
    expect(update).toHaveBeenCalledWith({
      business_name: "Warung Rina", address: "Jl. Braga", latitude: -6.914744,
      longitude: 107.60981, updated_at: expect.any(String),
    });
    expect(updateFilter).toHaveBeenCalledWith("user_id", "umkm-1");
    expect(insert).not.toHaveBeenCalled();
  });

  it("updates a complete profile and returns the stored coordinates", async () => {
    makeClient({ profile: savedProfile });
    const response = await PUT(jsonRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ profile: {
      businessName: "Warung Rina", address: "Jl. Braga", latitude: -6.914744, longitude: 107.60981,
    } });
  });

  it("creates a missing profile using only the authenticated user's identity", async () => {
    const { insert } = makeClient({ updateResults: [missing] });
    const response = await PUT(jsonRequest({ ...payload, user_id: "another-user", strike_count: 0 }));
    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: "umkm-1", business_name: "Warung Rina", address: "Jl. Braga",
      latitude: -6.914744, longitude: 107.60981, updated_at: expect.any(String),
    });
    await expect(response.json()).resolves.toMatchObject({ profile: { userId: "umkm-1" } });
  });

  it("retries the update once when another save creates the missing row first", async () => {
    const { update, updateFilter, insert } = makeClient({
      updateResults: [missing, saved],
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    const response = await PUT(jsonRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ profile: { businessName: "Warung Rina" } });
    expect(update).toHaveBeenCalledTimes(2);
    expect(updateFilter).toHaveBeenNthCalledWith(2, "user_id", "umkm-1");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "update permission denied", updateResults: [denied], insertResult: saved, updates: 1, inserts: 0 },
    { name: "insert permission denied", updateResults: [missing], insertResult: denied, updates: 1, inserts: 1 },
    { name: "insert returns no row", updateResults: [missing], insertResult: missing, updates: 1, inserts: 1 },
    { name: "conflict retry permission denied", updateResults: [missing, denied], insertResult: { data: null, error: { code: "23505" } }, updates: 2, inserts: 1 },
    { name: "conflict retry returns no row", updateResults: [missing, missing], insertResult: { data: null, error: { code: "23505" } }, updates: 2, inserts: 1 },
    { name: "update has data and an error", updateResults: [{ data: savedProfile, error: denied.error }], insertResult: saved, updates: 1, inserts: 0 },
  ])("returns a stable persistence error for $name", async ({ updateResults, insertResult, updates, inserts }) => {
    const { update, insert } = makeClient({ updateResults, insertResult });
    const response = await PUT(jsonRequest());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: "profile_save_failed", requestId: expect.any(String) });
    expect(update).toHaveBeenCalledTimes(updates);
    expect(insert).toHaveBeenCalledTimes(inserts);
  });

  it.each([
    { role: "supplier" as const, status: "active" as const },
    { role: "admin" as const, status: "active" as const },
    { role: "umkm" as const, status: "suspended_temporary" as const },
    { role: "umkm" as const, status: "suspended_permanent" as const },
    { role: "umkm" as const, status: "banned" as const },
  ])("rejects $role/$status before touching the table", async (options) => {
    const { client } = makeClient(options);
    const response = await PUT(jsonRequest());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "role_forbidden" });
    expect(client.from).not.toHaveBeenCalledWith("umkm_profiles");
  });

  it("rejects a pin outside the Bandung service radius", async () => {
    const { client } = makeClient();
    const response = await PUT(jsonRequest({ ...payload, latitude: -6.2, longitude: 107.6 }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "validation_error" });
    expect(client.from).not.toHaveBeenCalledWith("umkm_profiles");
  });

  it("rejects malformed JSON before any profile write", async () => {
    const { client } = makeClient();
    const response = await PUT(new Request("http://localhost/api/umkm/profile", { method: "PUT", body: "{" }));
    expect(response.status).toBe(400);
    expect(client.from).not.toHaveBeenCalledWith("umkm_profiles");
  });

  it("requires a session for reading and saving", async () => {
    const { client } = makeClient({ user: null });
    expect((await GET()).status).toBe(401);
    expect((await PUT(jsonRequest())).status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });
});
