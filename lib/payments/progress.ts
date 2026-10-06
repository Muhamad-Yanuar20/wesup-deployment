export type PaymentProgressState = "before_window" | "checkout_ready" | "checkout_created" | "awaiting_payment" | "status_unknown" | "paid" | "failed" | "expired" | "cancelled" | "refund_pending" | "refunded";
export interface PaymentProgress {
  state: PaymentProgressState;
  lastCheckedAt: string | null;
  canOpenCheckout: boolean;
  canCheckStatus: boolean;
  blockedReason: string | null;
  blockedCode?: "ORDER_CANCELLED" | "ORDER_STATUS_INCONSISTENT" | "PAYMENT_DEADLINE" | "PAYMENT_NOT_OPEN" | "PAYMENT_RECONCILIATION_REQUIRED" | null;
  integrityIssue?: "cancelled_with_paid_invoice" | "unexplained_cancellation_before_deadline";
}
export function selectPaymentAttempt(attempts: Array<Record<string, unknown>>) {
  const rank = (a: Record<string, unknown>) => a.status === "paid" ? 2 : ["pending", "creating"].includes(String(a.status)) ? 1 : 0;
  return [...attempts].sort((a, b) => rank(b) - rank(a) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}
export function derivePaymentProgress(input: { status: string; invoiceStatus?: unknown; providerOrderId?: unknown; attempt: Record<string, unknown> | null; now: string; opensAt: string | null; closesAt: string | null; lastCheckedAt?: string | null; hasLegacyCheckout?: boolean; cancellationReason?: string | null; batchStatus?: unknown }): PaymentProgress {
  const { attempt, status } = input;
  const now = Date.parse(input.now);
  const open = Boolean(input.opensAt && input.closesAt && now >= Date.parse(input.opensAt) && now < Date.parse(input.closesAt));
  const closed = Boolean(input.closesAt && now >= Date.parse(input.closesAt));
  const uncertain = Boolean(attempt && ["creating", "creation_unknown", "session_persist_failed", "order_id_mismatch", "status_unknown"].includes(String(attempt.provider_status)));
  const pending = Boolean(attempt && ["pending", "creating"].includes(String(attempt.status)));
  const checkoutElapsed = Boolean(attempt?.expires_at && now >= Date.parse(String(attempt.expires_at)));
  const invoiceConflict = input.invoiceStatus === "paid" && !["paid", "picked_up", "completed", "no_show", "refund_pending", "refunded"].includes(status);
  const integrityIssue = status === "cancelled" && input.invoiceStatus === "paid" ? "cancelled_with_paid_invoice" : status === "cancelled" && input.cancellationReason === null && ["published","closed"].includes(String(input.batchStatus)) && open ? "unexplained_cancellation_before_deadline" : null;
  const terminal = ["cancelled", "no_show", "refund_pending", "refunded", "paid", "picked_up", "completed"].includes(status);
  let state: PaymentProgressState;
  if (status === "refund_pending" || status === "refunded") state = status;
  else if (["paid", "picked_up", "completed"].includes(status)) state = "paid";
  else if (uncertain || invoiceConflict || (pending && (closed || terminal || checkoutElapsed))) state = "status_unknown";
  else if (status === "cancelled" || status === "no_show") state = "cancelled";
  else if (closed) state = "expired";
  else if (!open) state = "before_window";
  else if (attempt && ["failed", "expired"].includes(String(attempt.status))) state = "failed";
  else if (attempt?.payment_type) state = "awaiting_payment";
  else state = attempt ? "checkout_created" : "checkout_ready";
  const canOpenCheckout = open && status === "pending_payment" && (!input.invoiceStatus || input.invoiceStatus === "pending") && state !== "status_unknown";
  const canCheckStatus = !["paid", "refund_pending", "refunded"].includes(state) && Boolean(attempt || input.hasLegacyCheckout);
  return { state, lastCheckedAt: typeof attempt?.provider_checked_at === "string" ? attempt.provider_checked_at : input.lastCheckedAt ?? null, canOpenCheckout, canCheckStatus,
    ...(integrityIssue ? {integrityIssue} : {}),
    blockedCode: integrityIssue ? "ORDER_STATUS_INCONSISTENT" : canOpenCheckout ? null : state === "cancelled" ? "ORDER_CANCELLED" : state === "status_unknown" ? "PAYMENT_RECONCILIATION_REQUIRED" : state === "expired" ? "PAYMENT_DEADLINE" : state === "before_window" ? "PAYMENT_NOT_OPEN" : null,
    blockedReason: integrityIssue ? "Status pesanan perlu diperiksa. Muat ulang detail atau hubungi bantuan transaksi sebelum membayar." : canOpenCheckout ? null : state === "cancelled" ? "Pesanan dibatalkan. Lihat alasan pada detail pesanan." : state === "status_unknown" ? "Periksa status pembayaran sebelum membayar ulang." : state === "expired" ? "Batas bayar sudah berakhir." : state === "before_window" ? "Pembayaran belum dibuka." : null };
}
