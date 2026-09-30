import { describe, expect, it } from "vitest";
import { toUmkmOrderDetail, type OrderReadRow } from "@/lib/orders/read-model";
import { validateProviderPayment } from "@/lib/payments/provider-validation";

const timeline = { registration_opens_at: "2026-09-29T08:00:00Z", registration_closes_at: "2026-10-01T07:40:00Z", payment_opens_at: "2026-10-01T07:40:00Z", payment_closes_at: "2026-10-02T07:40:00Z", effective_payment_opens_at: "2026-09-29T11:50:00Z", effective_payment_closes_at: "2026-09-30T11:50:00Z", estimated_ready_at: "2026-10-05T07:40:00Z" };
function row(attempt = {}) : OrderReadRow { return { id: "order", batch_id: "batch", quantity: 24, status: "pending_payment", final_amount: 1680000, locked_price_per_unit: 70000, locked_tier_number: 2, created_at: "2026-09-29T08:00:00Z", batch: { transaction_policy_version: 1, registration_closed_at: "2026-09-29T11:50:00Z", close_reason: "capacity_reached", batch_timeline: timeline }, payment: { id: "payment", status: "pending", gross_amount: 1680000, payment_attempts: [{ id: "attempt", status: "pending", provider_status: "pending", payment_type: "bank_transfer", created_at: "2026-09-30T09:00:00Z", ...attempt }] } }; }

describe("one authoritative payment presentation", () => {
  it("keeps expired legacy attempts checkable and matches the banner phase", () => {
    const order = toUmkmOrderDetail(row(), "2026-10-01T00:00:00Z");
    expect(order.phase).toBe(order.presentation?.phase);
    expect(order.phase).toBe("payment_verifying");
    expect(order.paymentProgress).toMatchObject({ state: "status_unknown", canCheckStatus: true, canOpenCheckout: false });
    expect(order.presentation?.label).toBe("Status pembayaran belum terkonfirmasi");
    expect(order.lockedUnitPrice).toBe(70000);
    expect(order.timeline.registrationClosesAt).toBe("2026-09-29T11:50:00Z");
  });
  it("pending bank transfer is awaiting payment, not an ongoing verification", () => {
    const order = toUmkmOrderDetail(row({ provider_checked_at: "2026-09-30T09:10:00Z" }), "2026-09-30T09:11:00Z");
    expect(order.phase).toBe("payment_open");
    expect(order.paymentProgress).toMatchObject({ state: "awaiting_payment", canOpenCheckout: true, lastCheckedAt: "2026-09-30T09:10:00Z" });
  });
  it("confirmed paid attempts take precedence over another pending attempt", () => {
    const data = row(); data.status = "paid";
    data.payment = { status: "paid", payment_attempts: [{ id: "new", status: "pending", created_at: "2026-10-01" }, { id: "settled", status: "paid", provider_status: "settlement", created_at: "2026-09-30" }] };
    const order = toUmkmOrderDetail(data, "2026-10-01T00:00:00Z");
    expect(order.paymentAttempt?.id).toBe("settled");
    expect(order.paymentProgress?.state).toBe("paid");
    expect(order.phase).toBe("paid_waiting_ready");
  });
  it("a failed attempt remains retryable only inside the payment window", () => {
    expect(toUmkmOrderDetail(row({ status: "failed", provider_status: "deny" }), "2026-09-30T09:11:00Z").paymentProgress?.canOpenCheckout).toBe(true);
    expect(toUmkmOrderDetail(row({ status: "expired", provider_status: "expire" }), "2026-10-01T00:00:00Z").paymentProgress?.canOpenCheckout).toBe(false);
  });
  it("refund remains distinct from successfully collected payment", () => {
    const data = row({ status: "paid" }); data.status = "refund_pending"; data.payment!.status = "paid";
    expect(toUmkmOrderDetail(data, "2026-10-01T00:00:00Z").paymentProgress?.state).toBe("refund_pending");
  });
});

describe("provider result validation", () => {
  const valid = { order_id: "WESUP-1", gross_amount: "1680000.00", transaction_status: "settlement", currency: "IDR" };
  it("accepts the matching invoice", () => expect(validateProviderPayment(valid, "WESUP-1", 1680000)).toBe(true));
  it.each([{ ...valid, order_id: "other" }, { ...valid, gross_amount: "1" }, { ...valid, transaction_status: "capture", fraud_status: "challenge" }, { ...valid, currency: "USD" }, { ...valid, transaction_status: "something" }])("rejects mismatching or unaccepted results", raw => expect(validateProviderPayment(raw, "WESUP-1", 1680000)).toBe(false));
});
