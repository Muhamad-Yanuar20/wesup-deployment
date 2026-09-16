import { describe, expect, it } from "vitest";
import { derivePaymentUiState } from "@/lib/payments/ui-state";

describe("payment UI state when Snap is blocked", () => {
  it("treats a persistent CSP block as retryable checkout failure", () => {
    expect(derivePaymentUiState({
      phase: "payment_open",
      orderStatus: "pending_payment",
      canPay: true,
      attempt: { status: "pending", providerStatus: "pending", paymentMethod: null },
      snapState: "blocked",
      reconcileState: "idle",
      hasCheckoutRedirect: true,
    })).toBe("retryable_failure");
  });
});
