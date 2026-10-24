import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/batches/[id]/progress/route";
import { getServerClient } from "@/lib/supabase/server";
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const id = "44444444-4444-4444-8444-444444444444";
const row = { id, batch_status: "published", can_register: true, unavailable_reason: null, remaining_quantity: 7, registered_quantity: 3, registration_opens_at: "2026-10-23T00:00:00Z", registration_closes_at: "2026-10-25T00:00:00Z", server_time: "2026-10-24T00:00:00Z", tiers: [{ tier_number: 1, min_volume: 1, max_volume: null, price_per_unit: 10000 }] };
function mock(rows: unknown[] | null = [row], error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: rows, error });
  vi.mocked(getServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
}
const request = (batch = id) => GET(new Request("http://localhost"), { params: Promise.resolve({ id: batch }) });
beforeEach(() => vi.mocked(getServerClient).mockReset());
describe("marketplace progress durable availability", () => {
  it("rejects invalid ids without a database read", async () => { expect((await request("invalid")).status).toBe(400); expect(getServerClient).not.toHaveBeenCalled(); });
  it("keeps missing or hidden batches private", async () => { mock([]); expect((await request()).status).toBe(404); });
  it("returns availability and tier data in one public aggregate read", async () => {
    const rpc = mock(); const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ batchId: id, registeredQuantity: 3, availability: { canRegister: true, reason: null, remainingQuantity: 7 }, registrationOpensAt: row.registration_opens_at, serverTime: row.server_time });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_marketplace_batch", { p_batch_id: id, p_lat: null, p_lng: null });
  });
  it.each(["full", "expired", "closed"])("returns %s instead of a 404 that leaves the old form active", async reason => {
    mock([{ ...row, batch_status: "closed", can_register: false, unavailable_reason: reason }]);
    expect(await (await request()).json()).toMatchObject({ status: "closed", availability: { canRegister: false, reason } });
  });
  it("fails safely on an old schema rather than assuming an offer is open", async () => { mock([{ id, tiers: row.tiers }]); expect((await request()).status).toBe(503); });
  it("does not turn database failures into zero quantity", async () => { mock(null, new Error("database unavailable")); const response = await request(); expect(response.status).toBe(503); expect(await response.json()).not.toHaveProperty("registeredQuantity"); });
  it("treats an actual zero as data", async () => { mock([{ ...row, registered_quantity: 0 }]); expect(await (await request()).json()).toMatchObject({ registeredQuantity: 0 }); });
});
