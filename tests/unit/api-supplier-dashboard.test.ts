import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/suppliers/dashboard/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);

function mockSupplierClient() {
  const rpc = vi.fn(async () => ({ data: [{
    supplier_name: "Supplier Bandung", supplier_status: "approved", active_batch_count: 2,
    total_participant_count: 11, collected_revenue: "650000", ready_to_disburse: "125000",
    average_rating: "4.5", rating_count: 3,
    recent_batches: [{ id: "44444444-4444-4444-8444-444444444444", title: "Beras", category: "Makanan Siap Saji", status: "published", min_quantity: 20, product_photo_url: null, registration_opens_at: "2099-01-01T00:00:00.000Z", registered_quantity: 7 }],
  }], error: null }));
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "33333333-3333-4333-8333-333333333333", email: "supplier@example.com" } }, error: null })) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "supplier", status: "active", full_name: "Supplier" }, error: null })) })) })) })),
    rpc,
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return rpc;
}

describe("GET /api/suppliers/dashboard", () => {
  beforeEach(() => mockGetServerClient.mockReset());
  it("returns stable owned aggregates and mapped recent batches", async () => {
    const rpc = mockSupplierClient();
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      supplier: { displayName: "Supplier Bandung", verificationStatus: "approved" },
      summary: { activeBatchCount: 2, participantCount: 11, collectedRevenue: 650000, readyToDisburse: 125000, ratingAverage: 4.5, ratingTotal: 3 },
      recentBatches: [expect.objectContaining({ id: "44444444-4444-4444-8444-444444444444", registeredQuantity: 7 })],
    });
    expect(rpc).toHaveBeenCalledWith("get_supplier_dashboard_summary");
  });
});
