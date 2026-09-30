import type { OrderPresentationPhase } from "@/lib/orders/api-types";

export type PaymentUiState =
  | "before_window"
  | "checkout_ready"
  | "checkout_created"
  | "method_confirming"
  | "awaiting_payment"
  | "reconciling"
  | "paid"
  | "retryable_failure"
  | "expired"
  | "unavailable";

export type PaymentReconcileState = "idle" | "running" | "confirming" | "error";

export interface PaymentUiStateInput {
  phase: OrderPresentationPhase;
  orderStatus: string;
  canPay: boolean;
  attempt: { status: string; providerStatus: string | null; paymentMethod: string | null } | null;
  snapState: "loading" | "ready" | "blocked" | "error";
  reconcileState: PaymentReconcileState;
  hasCheckoutRedirect: boolean;
  hasError?: boolean;
}

const methodLabels: Record<string, string> = {
  qris: "QRIS",
  bank_transfer: "Virtual Account / Transfer Bank",
  bca_va: "Virtual Account / Transfer Bank",
  bni_va: "Virtual Account / Transfer Bank",
  bri_va: "Virtual Account / Transfer Bank",
  permata_va: "Virtual Account / Transfer Bank",
  echannel: "Virtual Account / Transfer Bank",
  credit_card: "Kartu Kredit/Debit",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  cstore: "Gerai Retail",
};

export function formatPaymentMethod(paymentType: string | null | undefined): string | null {
  if (!paymentType) return null;
  const normalized = paymentType.trim().toLowerCase();
  if (!normalized) return null;
  return methodLabels[normalized] ?? normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function derivePaymentUiState(input: PaymentUiStateInput): PaymentUiState {
  if (["paid", "picked_up", "completed"].includes(input.orderStatus)) return "paid";
  if (["payment_expired", "cancelled", "no_show", "refund_pending", "refunded"].includes(input.phase)) return "expired";
  if (input.phase === "waiting_payment_window" || input.phase === "registered") return "before_window";
  if (input.reconcileState === "running") return "reconciling";
  if (input.reconcileState === "confirming") return "method_confirming";
  if (input.phase === "payment_verifying") return "reconciling";
  if (input.hasError || input.snapState === "error" || input.snapState === "blocked") return "retryable_failure";
  if (input.phase !== "payment_open" || !input.canPay) return "unavailable";
  if (input.attempt?.paymentMethod) return "awaiting_payment";
  if (input.attempt) return "checkout_created";
  return "checkout_ready";
}