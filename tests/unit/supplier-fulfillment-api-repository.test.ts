import { afterEach, describe, expect, it, vi } from "vitest";
import { supplierFulfillmentApiRepository } from "@/lib/supplier-fulfillment/api-repository";

describe("supplier fulfillment API repository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps real list_batch_orders rows without fixture data", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ orders: [{ registration_id: "44444444-4444-4444-8444-444444444444", umkm_name: "Warung Bandung", quantity: 4, status: "paid", final_amount: "120000", lock_tier: 2, created_at: "2026-09-09T08:00:00Z" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await supplierFulfillmentApiRepository.listOrders("33333333-3333-4333-8333-333333333333");
    expect(result.orders[0]).toMatchObject({ batchId: "33333333-3333-4333-8333-333333333333", umkmName: "Warung Bandung", quantity: 4, finalAmount: 120000, lockedTier: 2, status: "paid" });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/suppliers/batches/33333333-3333-4333-8333-333333333333/orders"), expect.objectContaining({ cache: "no-store" }));
  });

  it("posts pickup confirmation to the real endpoint and updates cached order state", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ orders: [{ registration_id: "44444444-4444-4444-8444-444444444444", umkm_name: "Warung Bandung", quantity: 4, status: "paid", final_amount: 120000, lock_tier: 2, created_at: "2026-09-09T08:00:00Z" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await supplierFulfillmentApiRepository.listOrders("33333333-3333-4333-8333-333333333333");
    const result = await supplierFulfillmentApiRepository.confirmPickup("44444444-4444-4444-8444-444444444444", { method: "pin", code: "1234" });
    expect(result.order).toMatchObject({ status: "picked_up", pickedUpByMethod: "pin", umkmName: "Warung Bandung" });
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("/api/pickups/44444444-4444-4444-8444-444444444444/confirm"), expect.objectContaining({ method: "POST" }));
  });

  it("posts cancellation through the real Supplier endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await supplierFulfillmentApiRepository.forceMajeureCancel("33333333-3333-4333-8333-333333333333");
    expect(result.batchId).toBe("33333333-3333-4333-8333-333333333333");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/suppliers/batches/33333333-3333-4333-8333-333333333333/cancel"), expect.objectContaining({ method: "POST" }));
  });
});
