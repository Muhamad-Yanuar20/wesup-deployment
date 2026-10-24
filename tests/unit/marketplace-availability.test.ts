import { describe, expect, it } from "vitest";
import { mapMarketplaceRpcRow } from "@/lib/marketplace/api-mapper";
import { fetchMarketplaceDetail } from "@/lib/marketplace/server-repository";

describe("marketplace availability contract", () => {
  it.each(["not_open", "full"])("loads consent and schedule context for a temporarily %s policy-v2 offer", async reason => {
    const client = { rpc: async (name: string) => ({ data: name === "get_marketplace_batch" ? [{ id: "batch", can_register: false, unavailable_reason: reason, batch_status: "published" }] : { transaction_policy_version: 2, unit: "kg", payment_opens_at: "2026-10-25T00:00:00Z" }, error: null }) };
    const item = await fetchMarketplaceDetail(client as never, "batch");
    expect(item?.policyVersion).toBe(2);
    expect(item?.paymentOpensAt).toBe("2026-10-25T00:00:00Z");
  });
  it.each(["expired", "full", "closed", "not_open"])("preserves authoritative %s instead of assuming ACTIVE", reason => {
    const item = mapMarketplaceRpcRow({ id: "batch", batch_status: "closed", can_register: false, unavailable_reason: reason, remaining_quantity: 0, registration_opens_at: "2026-01-01T00:00:00Z", server_time: "2026-10-24T00:00:00Z" } as never);
    expect(item.status).toBe("CLOSED");
    expect(item).toMatchObject({ availability: { canRegister: false, reason, remainingQuantity: 0 }, serverTime: "2026-10-24T00:00:00Z", registrationOpensAt: "2026-01-01T00:00:00Z" });
  });
  it("does not invent availability when deployment has an old schema", () => {
    expect(mapMarketplaceRpcRow({ id: "batch" }).availability?.canRegister).not.toBe(true);
  });
  it("preserves an unbounded capacity and the server snapshot", () => {
    expect(mapMarketplaceRpcRow({ id: "batch", batch_status: "published", can_register: true, unavailable_reason: null, remaining_quantity: null, capacity_quantity: null } as never)).toMatchObject({ availability: { canRegister: true, reason: null, remainingQuantity: null } });
  });
});
