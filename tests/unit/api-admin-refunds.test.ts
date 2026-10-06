import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { GET as listRefunds } from "@/app/api/admin/refunds/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

function mockRefundsClient(rows: unknown[] = []) {
  const getUser = vi.fn(async () => ({
    data: { user: { id: ADMIN_ID, email: "admin@example.com" }, error: null },
  }));
  const single = vi.fn(async () => ({
    data: { role: "admin", status: "active", full_name: "Admin" },
    error: null,
  }));
  const range = vi.fn(async (_from: number, _to: number) => ({ data: rows, error: null }));
  const order = vi.fn(() => ({ range }));
  const eq = vi.fn(() => ({ eq, order }));
  const select = vi.fn(() => ({ eq, order }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) };
    }
    return { select };
  });
  const client = { auth: { getUser }, from };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, eq, order, range, select };
}

describe("GET /api/admin/refunds", () => {

  it("adapts joined registration details for the queue format", async () => {
    mockRefundsClient([{ id: "r1", amount: 50000, status: "pending", requested_at: "2026-10-01", registration: { cancellation_reason: "supplier_cancelled", batch: { title: "Beras" }, umkm: { full_name: "Buyer", email: "buyer@example.com" } } }]);
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    const res = await listRefunds(new NextRequest("http://localhost/api/admin/refunds?format=queue"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: "r1", amount: 50000, status: "pending", createdAt: "2026-10-01", reason: "supplier_cancelled", batchTitle: "Beras", umkmName: "Buyer", email: "buyer@example.com" }]);
  });
  beforeEach(() => {
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    mockRefundsClient([]);
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "rate_limited" }, { status: 429 }),
    );
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds"),
    );
    expect(res.status).toBe(429);
  });

  it("returns 200 with refunds ordered by requested_at desc and paginated", async () => {
    const rows = [{ id: "r1", amount: "50000" }];
    const { order, range } = mockRefundsClient(rows);
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds?limit=10&offset=5"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ refunds: rows });
    expect(order).toHaveBeenCalledWith("requested_at", { ascending: false });
    expect(range).toHaveBeenCalledWith(5, 14);
  });

  it("applies the status filter", async () => {
    const { eq } = mockRefundsClient([]);
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds?status=pending"),
    );
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("status", "pending");
  });

  it("accepts every refund_status value as a filter", async () => {
    for (const status of [
      "pending",
      "waiting_bank_account",
      "processing",
      "completed",
      "failed",
    ]) {
      mockRefundsClient([]);
      const res = await listRefunds(
        new NextRequest(`http://localhost/api/admin/refunds?status=${status}`),
      );
      expect(res.status).toBe(200);
    }
  });

  it("returns 400 for an unknown status", async () => {
    mockRefundsClient();
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds?status=rich"),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid status" });
  });

  it("returns 400 for an invalid limit", async () => {
    mockRefundsClient();
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds?limit=0"),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "limit must be an integer between 1 and 100",
    });
  });

  it("returns 400 for an invalid offset", async () => {
    mockRefundsClient();
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds?offset=-1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    const { client } = mockRefundsClient();
    const getUser = client.auth.getUser as ReturnType<typeof vi.fn>;
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin role", async () => {
    const { client } = mockRefundsClient();
    (client.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { role: "umkm", status: "active", full_name: "Buyer" },
                error: null,
              })),
            })),
          })),
        };
      }
      return {};
    });
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 when the query fails", async () => {
    const { range } = mockRefundsClient();
    range.mockResolvedValue({
      data: null as unknown as unknown[],
      error: { message: "boom" } as unknown as null,
    });
    const res = await listRefunds(
      new NextRequest("http://localhost/api/admin/refunds"),
    );
    expect(res.status).toBe(500);
  });
});
