import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { POST as register } from "@/app/api/registrations/route";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/orders/registration-counter", () => ({
  adjustVolumeCounter: vi.fn(async () => 12),
}));

const mockGetServerClient = vi.mocked(getServerClient);
const mockEnforceRateLimit = vi.mocked(enforceRateLimit);

const UMKM_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const TIMELINE = {
  registration_opens_at: "2026-09-01T00:00:00.000Z",
  registration_closes_at: "2026-09-30T00:00:00.000Z",
  payment_opens_at: "2026-10-01T00:00:00.000Z",
  payment_closes_at: "2026-10-02T00:00:00.000Z",
  estimated_ready_at: "2026-10-03T00:00:00.000Z",
};

function request(body = { batchId: BATCH_ID, quantity: 2 }) {
  return new NextRequest("http://localhost/api/registrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockClient(options: {
  user?: { id: string; email: string } | null;
  role?: "umkm" | "supplier" | "admin";
  profile?: { user_id: string; business_name?: string | null; address?: string | null; latitude?: number | string | null; longitude?: number | string | null } | null;
}) {
  const inserted: Array<Record<string, unknown>> = [];
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === undefined ? { id: UMKM_ID, email: "umkm@example.com" } : options.user },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => options.user === null
                ? { data: null, error: new Error("missing") }
                : { data: { role: options.role ?? "umkm", status: "active", full_name: "Rina" }, error: null }),
            })),
          })),
        };
      }
      if (table === "umkm_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: options.profile ?? null, error: null })) })),
          })),
        };
      }
      if (table === "batches") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { status: "published" }, error: null })) })) })) };
      }
      if (table === "batch_timeline") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: TIMELINE, error: null })) })) })) };
      }
      if (table === "batch_tiers") {
        return { select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ tier_number: 1, min_volume: 1, max_volume: null, price_per_unit: 1000 }], error: null })) })) };
      }
      if (table === "registrations") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            inserted.push(row);
            return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "reg-1" }, error: null })) })) };
          }),
        };
      }
      return { select: vi.fn() };
    }),
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, inserted };
}

describe("POST /api/registrations profile gate", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    mockEnforceRateLimit.mockResolvedValue(null);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T10:00:00.000Z"));
  });

  it("returns 401 for a guest with an explicit unauthenticated code", async () => {
    mockClient({ user: null });
    const response = await register(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "unauthenticated" });
  });

  it("returns 403 role_forbidden for a Supplier", async () => {
    mockClient({ role: "supplier", profile: null });
    const response = await register(request());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "role_forbidden" });
  });

  it("returns 409 profile_incomplete before reading batch data", async () => {
    const { client } = mockClient({ role: "umkm", profile: null });
    const response = await register(request());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "profile_incomplete" });
    expect(client.from).not.toHaveBeenCalledWith("batches");
  });

  it("writes consented_at on the server for a complete UMKM profile", async () => {
    const { inserted } = mockClient({ role: "umkm", profile: { user_id: UMKM_ID, business_name: "Warung Rina", address: "Bandung", latitude: -6.914744, longitude: 107.60981 } });
    const response = await register(request());
    expect(response.status).toBe(201);
    expect(inserted[0]?.consented_at).toBe("2026-09-09T10:00:00.000Z");
    expect(inserted[0]?.consented_at).not.toBe((await request().json().catch(() => null))?.consentedAt);
  });
});
