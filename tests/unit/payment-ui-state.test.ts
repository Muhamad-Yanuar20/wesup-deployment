import { describe, expect, it } from "vitest";
import { derivePaymentUiState, formatPaymentMethod } from "@/lib/payments/ui-state";

describe("payment UI state", () => {
  it("keeps a pending session without payment_type in checkout_created", () => {
    expect(derivePaymentUiState({
      phase: "payment_open",
      orderStatus: "pending_payment",
      canPay: true,
      attempt: { status: "pending", providerStatus: "pending", paymentMethod: null },
      snapState: "ready",
      reconcileState: "idle",
      hasCheckoutRedirect: true,
    })).toBe("checkout_created");
  });

  it("shows awaiting_payment only after the server confirms a method", () => {
    expect(derivePaymentUiState({
      phase: "payment_open",
      orderStatus: "pending_payment",
      canPay: true,
      attempt: { status: "pending", providerStatus: "pending", paymentMethod: "qris" },
      snapState: "ready",
      reconcileState: "idle",
      hasCheckoutRedirect: true,
    })).toBe("awaiting_payment");
  });

  it("separates unknown verification from unavailable checkout", () => {
    expect(derivePaymentUiState({ phase: "payment_verifying", orderStatus: "pending_payment", canPay: false, attempt: null, snapState: "ready", reconcileState: "idle", hasCheckoutRedirect: false })).toBe("unknown");
  });

  it("maps provider payment types to friendly labels", () => {
    expect(formatPaymentMethod("bca_va")).toBe("Virtual Account / Transfer Bank");
    expect(formatPaymentMethod("credit_card")).toBe("Kartu Kredit/Debit");
    expect(formatPaymentMethod("shopeepay")).toBe("ShopeePay");
  });
});
