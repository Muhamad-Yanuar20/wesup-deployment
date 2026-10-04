import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as register } from "@/app/api/registrations/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const { incrbyMock, evalMock } = vi.hoisted(() => ({
  incrbyMock: vi.fn(),
  evalMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { incrby: incrbyMock, eval: evalMock },
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return {
    ...actual,
    enforceRateLimit: vi.fn(async () => null),
  };
});

import { enforceRateLimit } from "@/lib/rate-limit";

const mockGetServerClient = vi.mocked(getServerClient);
const mockEnforceRateLimit = vi.mocked(enforceRateLimit);

const UMKM_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

const TIMELINE = {
  registration_opens_at: "2026-09-01T00:00:00.000Z",
  registration_closes_at: "2026-09-02T00:00:00.000Z",
  payment_opens_at: "2026-09-02T01:00:00.000Z",
  payment_closes_at: "2026-09-03T00:00:00.000Z",
  estimated_ready_at: "2026-09-04T00:00:00.000Z",
};

const TIERS = [
  { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 10000 },
  { tier_number: 2, min_volume: 50, max_volume: 99, price_per_unit: 9000 },
];

function buildClient() {
  const getUser = vi.fn(async () => ({
    data: { user: { id: UMKM_ID, email: "umkm@example.com" }, error: null },
  }));

  const batchSingle = vi.fn(async () => ({
    data: {
      id: BATCH_ID,
      status: "published",
      batch_timeline: TIMELINE,
      batch_tiers: TIERS,
    },
    error: null,
  }));

  const upsert = vi.fn(async () => ({ error: null }));
  const insertSingle = vi.fn(async () => ({ data: { id: "reg-1" }, error: null }));
  const selectInserted = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: selectInserted }));

  const rpc = vi.fn(async () => ({ data: null, error: null }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "umkm", status: "active", full_name: "UMKM" }, error: null })) })),
        })),
      };
    }
    if (table === "umkm_profiles") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { user_id: UMKM_ID, business_name: "Warung UMKM", address: "Bandung", latitude: -6.914744, longitude: 107.60981 }, error: null })) })) })) };
    }
    if (table === "batches") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: batchSingle })) })) };
    }
    if (table === "registrations") {
      return { insert };
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })) };
  });

  const client = { auth: { getUser }, from, rpc };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client };
}

const validBody = {
  batchId: BATCH_ID,
  quantity: 5,
  consentLat: -6.9175,
  consentLng: 107.6191,
};

describe("POST /api/registrations CSRF", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-09-01T12:00:00.000Z"));
    mockGetServerClient.mockReset();
    mockEnforceRateLimit.mockReset();
    mockEnforceRateLimit.mockResolvedValue(null as never);
    incrbyMock.mockReset();
    evalMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows when origin is missing (backward compatible)", async () => {
    buildClient();
    incrbyMock.mockResolvedValue(10);
    const req = new NextRequest("http://localhost/api/registrations", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const res = await register(req as unknown as Request);
    expect(res.status).toBe(201);
  });

  it("rejects cross-origin request", async () => {
    buildClient();
    const req = new NextRequest("http://localhost/api/registrations", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", "origin": "https://evil.example" },
    });
    const res = await register(req as unknown as Request);
    expect(res.status).toBe(403);
  });

  it("allows same-origin request", async () => {
    buildClient();
    incrbyMock.mockResolvedValue(10);
    const req = new NextRequest("http://localhost/api/registrations", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", "origin": "http://localhost" },
    });
    const res = await register(req as unknown as Request);
    expect(res.status).toBe(201);
  });

  it("allows localhost variants", async () => {
    buildClient();
    incrbyMock.mockResolvedValue(10);
    const req = new NextRequest("http://localhost/api/registrations", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json", "origin": "http://localhost:3000" },
    });
    const res = await register(req as unknown as Request);
    expect(res.status).toBe(201);
  });
});
