import { describe, expect, it } from "vitest";
import { toUmkmOrderDetail, toUmkmOrderListItem, type OrderReadRow } from "@/lib/orders/read-model";

const base: OrderReadRow = {
  id: "11111111-1111-4111-8111-111111111111",
  batch_id: "22222222-2222-4222-8222-222222222222",
  quantity: 10,
  status: "picked_up",
  final_amount: "125000",
  locked_tier_number: 2,
  created_at: "2026-09-01T00:00:00.000Z",
  batch: {
    title: "Kentang",
    unit: "kg",
    supplier: { full_name: "Supplier Bandung" },
    batch_timeline: [{
      registration_opens_at: "2026-08-20T00:00:00.000Z",
      registration_closes_at: "2026-08-25T00:00:00.000Z",
      payment_opens_at: "2026-08-26T00:00:00.000Z",
      payment_closes_at: "2026-08-27T00:00:00.000Z",
      estimated_ready_at: "2026-09-02T00:00:00.000Z",
    }],
  },
  escrow: { pickup_confirmed_at: "2026-09-02T08:00:00.000Z", status: "held" },
};

describe("UMKM order read model", () => {
  it("derives a server-owned complaint deadline and capability", () => {
    const item = toUmkmOrderListItem(base, "2026-09-02T20:00:00.000Z");
    expect(item.timeline.complaintDeadlineAt).toBe("2026-09-03T08:00:00.000Z");
    expect(item.capabilities.canComplain).toBe(true);
    expect(item.unit).toBe("kg");
  });

  it("does not expose the payment CTA after the payment window expires", () => {
    const item = toUmkmOrderListItem({ ...base, status: "pending_payment" }, "2026-08-28T00:00:00.000Z");
    expect(item.phase).toBe("payment_expired");
    expect(item.capabilities.canPay).toBe(false);
  });

  it("does not expose refund-account CTA after a bank account is attached", () => {
    const item = toUmkmOrderListItem({ ...base, status: "refund_pending", refund: { umkm_bank_account_id: "bank-1" } }, "2026-09-02T20:00:00.000Z");
    expect(item.capabilities.canSubmitRefundAccount).toBe(false);
  });

  it("maps nested invoice, attempt, dispute and refund records", () => {
    const detail = toUmkmOrderDetail({ ...base, payment: { id: "pay-1", gross_amount: "125000", status: "paid" }, payment_attempt: { id: "attempt-1", status: "paid", provider_order_id: "WESUP-1" }, dispute: { complaint_category: "cacat", photo_urls: ["disputes/a.webp"], status: "pending", created_at: "2026-09-02T09:00:00.000Z" }, refund: { id: "refund-1", amount: "125000", status: "pending", trigger_type: "dispute_won" } }, "2026-09-02T20:00:00.000Z");
    expect(detail.invoice?.status).toBe("paid");
    expect(detail.paymentAttempt?.providerOrderId).toBe("WESUP-1");
    expect(detail.dispute?.photoUrls).toEqual(["disputes/a.webp"]);
    expect(detail.refund?.id).toBe("refund-1");
  });

  it("reads the active attempt through the payment relationship", () => {
    const detail = toUmkmOrderDetail({
      ...base,
      status: "pending_payment",
      payment: {
        id: "pay-1",
        gross_amount: "125000",
        status: "pending",
        payment_attempts: [
          { id: "attempt-old", status: "failed", provider_order_id: "WESUP-OLD", created_at: "2026-09-01T00:00:00.000Z" },
          { id: "attempt-active", status: "pending", provider_order_id: "WESUP-ACTIVE", payment_type: "qris", created_at: "2026-09-02T00:00:00.000Z" },
        ],
      },
    }, "2026-09-02T20:00:00.000Z");
    expect(detail.paymentAttempt?.id).toBe("attempt-active");
    expect(detail.paymentAttempt?.paymentMethod).toBe("qris");
  });
});
