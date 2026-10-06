import { describe, expect, it } from "vitest";
import { derivePaymentProgress } from "@/lib/payments/progress";
import { derivePaymentUiState } from "@/lib/payments/ui-state";

const input = { status: "pending_payment", invoiceStatus: "pending", attempt: null, now: "2026-10-02T09:00:00Z", opensAt: "2026-10-01T20:45:00Z", closesAt: "2026-10-02T20:45:00Z" };
describe("payment continuation inside the server window", () => {
  it("does not describe a cancelled order as an expired window", () => {
    expect(derivePaymentProgress({ ...input, status: "cancelled" })).toMatchObject({state: "cancelled", canOpenCheckout: false, blockedCode: "ORDER_CANCELLED"});
    expect(derivePaymentUiState({phase:"cancelled",orderStatus:"cancelled",canPay:false,attempt:null,snapState:"ready",reconcileState:"idle",hasCheckoutRedirect:false})).toBe("cancelled");
  });
  it.each(["expire", "deny", "cancel"])("allows retry after confirmed %s while the invoice remains payable", provider_status => {
    expect(derivePaymentProgress({...input, attempt:{status:provider_status === "expire" ? "expired" : "failed",provider_status,expires_at:"2026-10-02T08:00:00Z"}})).toMatchObject({state:"failed",canOpenCheckout:true});
  });
  it("keeps an elapsed checkout pending until reconciliation", () => {
    expect(derivePaymentProgress({...input,attempt:{status:"pending",provider_status:"pending",expires_at:"2026-10-02T08:00:00Z"}})).toMatchObject({state:"status_unknown",canOpenCheckout:false,canCheckStatus:true});
  });
  it("never reopens an already paid invoice", () => {
    expect(derivePaymentProgress({...input,invoiceStatus:"paid"})).toMatchObject({state:"status_unknown",canOpenCheckout:false});
  });
  it("does not mistake a paid no-show for an inconsistent invoice", () => {
    expect(derivePaymentProgress({...input,status:"no_show",invoiceStatus:"paid"})).toMatchObject({state:"cancelled",canOpenCheckout:false});
  });
  it("closes at the exact effective deadline", () => {
    expect(derivePaymentProgress({...input,now:input.closesAt})).toMatchObject({state:"expired",canOpenCheckout:false,blockedCode:"PAYMENT_DEADLINE"});
  });
});
