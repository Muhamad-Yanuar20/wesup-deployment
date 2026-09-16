import { describe, expect, it } from "vitest";
import {
  claimPaymentRecovery,
  clearPaymentRecovery,
  isMidtransFramePolicyViolation,
  isUnexpectedPaymentDocumentNavigation,
  paymentRecoveryStorageKey,
} from "@/lib/payments/navigation-recovery";

describe("payment navigation recovery", () => {
  it("detects a payment page reached through client navigation", () => {
    expect(isUnexpectedPaymentDocumentNavigation("/pesanan/order-1/bayar", "https://wesup.test/umkm/pesanan")).toBe(true);
    expect(isUnexpectedPaymentDocumentNavigation("/pesanan/order-1/bayar", "https://wesup.test/pesanan/order-1/bayar")).toBe(false);
  });

  it("claims a recovery only once per order and can clear it", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const key = paymentRecoveryStorageKey("order-1");
    expect(claimPaymentRecovery(storage, key)).toBe(true);
    expect(claimPaymentRecovery(storage, key)).toBe(false);
    clearPaymentRecovery(storage, key);
    expect(claimPaymentRecovery(storage, key)).toBe(true);
  });

  it("recognizes only Midtrans frame policy violations", () => {
    expect(isMidtransFramePolicyViolation({ blockedURI: "https://app.sandbox.midtrans.com/", effectiveDirective: "frame-src" })).toBe(true);
    expect(isMidtransFramePolicyViolation({ blockedURI: "https://example.test/", effectiveDirective: "frame-src" })).toBe(false);
    expect(isMidtransFramePolicyViolation({ blockedURI: "https://app.sandbox.midtrans.com/", effectiveDirective: "script-src" })).toBe(false);
  });
});
