const STATUSES = new Set(["pending", "settlement", "capture", "expire", "deny", "cancel", "refund", "partial_refund", "chargeback", "partial_chargeback", "failure"]);
/** A callback or provider response can never settle a different invoice. */
export function validateProviderPayment(raw: Record<string, unknown>, orderId: string, amount: number, merchantId?: string): boolean {
  const gross = Number(raw.gross_amount);
  const status = String(raw.transaction_status ?? "").toLowerCase();
  return raw.order_id === orderId && Number.isFinite(gross) && Math.abs(gross - amount) < 0.005
    && STATUSES.has(status) && (!raw.currency || raw.currency === "IDR")
    && (!merchantId || raw.merchant_id === merchantId)
    && (!(status === "capture" || status === "settlement") || !raw.fraud_status || raw.fraud_status === "accept")
    && (status !== "capture" || raw.fraud_status === "accept");
}
