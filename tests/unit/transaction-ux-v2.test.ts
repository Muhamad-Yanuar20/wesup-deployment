import { describe, expect, it } from "vitest";
import { buildOfferSchedule, normalizePriceTiers, validatePickupWindow } from "@/lib/transactions/schedule";
import { deriveTransactionPresentation } from "@/lib/transactions/presentation";

describe("jadwal penawaran versi 2", () => {
  const now = "2026-10-01T01:00:00.000Z";
  it("opens at publication and keeps a full fixed 24-hour payment window", () => {
    const result = buildOfferSchedule({ openingMode: "immediate", collectionDays: 1, pickupStartsAt: "2026-10-04T08:00:00+07:00", pickupEndsAt: "2026-10-04T20:00:00+07:00" }, now);
    expect(result.registrationOpensAt).toBe(now);
    expect(result.registrationClosesAt).toBe("2026-10-02T01:00:00.000Z");
    expect(result.paymentOpensAt).toBe(result.registrationClosesAt);
    expect(result.paymentClosesAt).toBe("2026-10-03T01:00:00.000Z");
  });
  it("rejects stale scheduled opening and pickup before payment closes", () => {
    expect(() => buildOfferSchedule({ openingMode: "scheduled", scheduledOpensAt: now, collectionDays: 1, pickupStartsAt: "2026-10-04T01:00:00Z", pickupEndsAt: "2026-10-04T13:00:00Z" }, now)).toThrow();
    expect(() => buildOfferSchedule({ openingMode: "immediate", collectionDays: 1, pickupStartsAt: "2026-10-02T01:00:00Z", pickupEndsAt: "2026-10-02T13:00:00Z" }, now)).toThrow();
  });
  it("validates Bandung daytime pickup independently of device timezone", () => {
    expect(validatePickupWindow("2026-10-04T06:00:00+07:00", "2026-10-04T10:00:00+07:00")).toBeNull();
    expect(validatePickupWindow("2026-10-04T20:00:00+07:00", "2026-10-05T08:00:00+07:00")).not.toBeNull();
    expect(validatePickupWindow("2026-10-04T08:00:00+07:00", "2026-10-04T11:00:00+07:00")).not.toBeNull();
  });
  it("derives contiguous tier boundaries instead of asking the supplier", () => {
    expect(normalizePriceTiers([{ minimumQuantity: 1, pricePerUnit: 10000 }, { minimumQuantity: 25, pricePerUnit: 9000 }])).toEqual([
      { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 24, pricePerUnit: 10000 },
      { tierNumber: 2, minimumQuantity: 25, maximumQuantity: null, pricePerUnit: 9000 },
    ]);
    expect(() => normalizePriceTiers([{ minimumQuantity: 1, pricePerUnit: 10000 }, { minimumQuantity: 1, pricePerUnit: 9000 }])).toThrow();
  });
});

describe("transaction next action", () => {
  const base = { policyVersion: 2, status: "paid", now: "2026-10-04T02:00:00Z", pickupStartsAt: "2026-10-04T01:00:00Z", pickupEndsAt: "2026-10-04T13:00:00Z", readyAt: null, orderId: "order-1" };
  it("does not tell a paid buyer to collect goods the supplier has not prepared", () => {
    expect(deriveTransactionPresentation(base).phase).toBe("supplier_delayed");
    expect(deriveTransactionPresentation(base).primaryAction.label).toBe("Pilih kelanjutan pesanan");
  });
  it("never advances pickup when supplier marks ready early", () => {
    expect(deriveTransactionPresentation({ ...base, now: "2026-10-04T00:00:00Z", readyAt: "2026-10-03T23:00:00Z" }).phase).toBe("paid_waiting_ready");
  });
  it("shows pickup only after timely actual readiness and the promised start", () => {
    expect(deriveTransactionPresentation({ ...base, readyAt: "2026-10-04T00:30:00Z" }).phase).toBe("ready_for_pickup");
  });
  it("keeps uncertain expired payments in verification rather than declaring failure", () => {
    expect(deriveTransactionPresentation({ ...base, status: "pending_payment", pendingAttempt: true, paymentClosesAt: "2026-10-03T01:00:00Z" }).phase).toBe("payment_verifying");
  });
  it("does not encourage normal buyers to complain after pickup", () => {
    expect(deriveTransactionPresentation({ ...base, status: "picked_up" }).primaryAction.label).toBe("Lihat detail pesanan");
  });
});
