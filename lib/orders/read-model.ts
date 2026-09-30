import { deriveOrderPhase, type OrderPhase } from "./lifecycle";
import type { BatchTimeline } from "./time-gatekeeper";
import type { OrderCapabilities, OrderPresentationPhase, UmkmOrderDetail, UmkmOrderListItem } from "./api-types";

export interface OrderReadRow {
  id: string;
  batch_id: string;
  quantity: number;
  status: string;
  final_amount: number | string | null;
  locked_tier_number: number | null;
  created_at: string;
  batch?: Record<string, unknown> | null;
  payment?: Record<string, unknown> | null;
  payment_attempt?: Record<string, unknown> | null;
  pickup_code?: Record<string, unknown> | null;
  escrow?: Record<string, unknown> | null;
  dispute?: Record<string, unknown> | null;
  rating?: Record<string, unknown> | null;
  refund?: Record<string, unknown> | null;
}

const moneyNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stringValue = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;

function firstObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function paymentAttemptFromRow(row: OrderReadRow): Record<string, unknown> | null {
  const payment = firstObject(row.payment);
  const attempts = Array.isArray(payment?.payment_attempts)
    ? payment.payment_attempts.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"))
    : [];
  attempts.sort((left, right) => {
    const leftPending = left.status === "pending" || left.status === "creating" ? 1 : 0;
    const rightPending = right.status === "pending" || right.status === "creating" ? 1 : 0;
    if (leftPending !== rightPending) return rightPending - leftPending;
    return String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""));
  });
  return attempts[0] ?? firstObject(row.payment_attempt);
}
function timelineFromBatch(batch: Record<string, unknown> | null): BatchTimeline | null {
  const timeline = firstObject(batch?.batch_timeline ?? batch?.timeline);
  if (!timeline) return null;
  const fields = ["registration_opens_at", "registration_closes_at", "payment_opens_at", "payment_closes_at", "estimated_ready_at"];
  if (!fields.every((field) => typeof timeline[field] === "string")) return null;
  return timeline as unknown as BatchTimeline;
}

function fallbackPhase(status: string): OrderPresentationPhase {
  if (status === "pending_payment") return "payment_open";
  if (status === "paid") return "paid_waiting_ready";
  if (status === "picked_up") return "picked_up";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  if (status === "cancelled") return "cancelled";
  if (status === "refund_pending") return "refund_pending";
  if (status === "refunded") return "refunded";
  return "registered";
}

function asPhase(status: string, timeline: BatchTimeline | null, serverNow: string): OrderPresentationPhase {
  if (!timeline) return fallbackPhase(status);
  return deriveOrderPhase(status as Parameters<typeof deriveOrderPhase>[0], timeline, serverNow) as OrderPhase;
}

function getDeadlines(timeline: BatchTimeline | null, pickupConfirmedAt: string | null): UmkmOrderListItem["timeline"] {
  if (!timeline) return { registrationClosesAt: null, paymentOpensAt: null, paymentClosesAt: null, estimatedReadyAt: null, pickupDeadlineAt: null, complaintDeadlineAt: null };
  const ready = Date.parse(timeline.estimated_ready_at);
  const pickupDeadlineAt = Number.isFinite(ready) ? new Date(ready + 12 * 60 * 60 * 1000).toISOString() : null;
  const pickupAt = pickupConfirmedAt ? Date.parse(pickupConfirmedAt) : Number.NaN;
  const complaintDeadlineAt = Number.isFinite(pickupAt) ? new Date(pickupAt + 24 * 60 * 60 * 1000).toISOString() : null;
  return { registrationClosesAt: timeline.registration_closes_at, paymentOpensAt: timeline.effective_payment_opens_at ?? timeline.payment_opens_at, paymentClosesAt: timeline.effective_payment_closes_at ?? timeline.payment_closes_at, estimatedReadyAt: timeline.estimated_ready_at, pickupDeadlineAt, complaintDeadlineAt };
}

function capabilitiesFor(status: string, phase: OrderPresentationPhase, row: OrderReadRow, now: string): OrderCapabilities {
  const payment = firstObject(row.payment);
  const dispute = firstObject(row.dispute);
  const rating = firstObject(row.rating);
  const refund = firstObject(row.refund);
  const pickupConfirmedAt = stringValue(firstObject(row.escrow)?.pickup_confirmed_at);
  const complaintDeadlineAt = getDeadlines(timelineFromBatch(firstObject(row.batch)), pickupConfirmedAt).complaintDeadlineAt;
  const hasPickedUp = status === "picked_up" || status === "completed";
  const complaintOpen = hasPickedUp && complaintDeadlineAt !== null && Date.parse(now) <= Date.parse(complaintDeadlineAt);
  return {
    canPay: phase === "payment_open" && status === "pending_payment" && (payment?.status === undefined || payment.status === "pending"),
    canViewPickup: status === "paid" || hasPickedUp,
    canComplain: complaintOpen && !dispute,
    canTrackDispute: Boolean(dispute),
    canRate: hasPickedUp && !rating,
    canSubmitRefundAccount: status === "refund_pending" && (!refund || refund.umkm_bank_account_id === null || refund.umkm_bank_account_id === undefined),
  };
}

function displayCode(batchId: string): string {
  return `BATCH-${batchId.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function toUmkmOrderListItem(row: OrderReadRow, serverNow: string): UmkmOrderListItem {
  const batch = firstObject(row.batch);
  const timeline = timelineFromBatch(batch);
  const status = row.status as UmkmOrderListItem["status"];
  const phase = asPhase(status, timeline, serverNow);
  const supplier = firstObject(batch?.supplier ?? batch?.profile);
  const pickupConfirmedAt = stringValue(firstObject(row.escrow)?.pickup_confirmed_at);
  const item = {
    id: row.id,
    batchId: row.batch_id,
    batchTitle: stringValue(batch?.title) ?? "Batch tanpa judul",
    batchDisplayCode: displayCode(row.batch_id),
    supplierName: stringValue(supplier?.full_name ?? supplier?.business_name) ?? "Supplier",
    batchStatus: stringValue(batch?.status),
    quantity: Number(row.quantity),
    unit: stringValue(batch?.unit) ?? "pcs",
    status,
    phase,
    finalAmount: moneyNumber(row.final_amount),
    lockedTier: row.locked_tier_number ?? null,
    createdAt: row.created_at,
    timeline: getDeadlines(timeline, pickupConfirmedAt),
    capabilities: capabilitiesFor(status, phase, row, serverNow),
    paymentStatus: stringValue(firstObject(row.payment)?.status),
    pickupConfirmedAt,
  } satisfies UmkmOrderListItem;
  return item;
}

export function toUmkmOrderDetail(row: OrderReadRow, serverNow: string): UmkmOrderDetail {
  const item = toUmkmOrderListItem(row, serverNow);
  const payment = firstObject(row.payment);
  const attempt = paymentAttemptFromRow(row);
  const pickup = firstObject(row.pickup_code);
  const escrow = firstObject(row.escrow);
  const dispute = firstObject(row.dispute);
  const rating = firstObject(row.rating);
  const refund = firstObject(row.refund);
  return {
    ...item,
    invoice: payment ? { paymentId: String(payment.id), grossAmount: moneyNumber(payment.gross_amount) ?? 0, status: String(payment.status ?? "pending"), midtransOrderId: String(payment.midtrans_order_id ?? ""), qrCodeUrl: stringValue(payment.qr_code_url), qrCodeExpiresAt: stringValue(payment.qr_code_expires_at), paidAt: stringValue(payment.paid_at) } : null,
    paymentAttempt: attempt ? { id: String(attempt.id), providerOrderId: String(attempt.provider_order_id ?? ""), status: String(attempt.status ?? "pending"), checkoutMode: attempt.integration_type === "snap" ? "snap" : "core_qris", providerStatus: stringValue(attempt.provider_status), paymentMethod: stringValue(attempt.payment_type), qrCodeUrl: stringValue(attempt.qr_code_url), expiresAt: stringValue(attempt.expires_at) } : null,
    pickup: pickup ? { qrCodeToken: stringValue(pickup.qr_code_token), pinCode: stringValue(pickup.pin_code), generatedAt: stringValue(pickup.generated_at), usedAt: stringValue(pickup.used_at), address: stringValue(firstObject(row.batch)?.pickup_address) } : item.capabilities.canViewPickup ? { qrCodeToken: null, pinCode: null, generatedAt: null, usedAt: null, address: stringValue(firstObject(row.batch)?.pickup_address) } : null,
    escrow: escrow ? { id: String(escrow.id), amount: moneyNumber(escrow.amount) ?? 0, status: String(escrow.status ?? "held"), pickupConfirmedAt: stringValue(escrow.pickup_confirmed_at), autoReleaseAt: stringValue(escrow.auto_release_at) } : null,
    dispute: dispute ? { id: String(dispute.id), complaintCategory: dispute.complaint_category === "busuk" ? "busuk" : "cacat", description: String(dispute.description ?? ""), photoUrls: Array.isArray(dispute.photo_urls) ? dispute.photo_urls.map(String) : [], status: String(dispute.status ?? "pending"), createdAt: String(dispute.created_at ?? ""), decidedAt: stringValue(dispute.decided_at) } : null,
    rating: rating ? { score: Number(rating.score), comment: stringValue(rating.comment), createdAt: String(rating.created_at ?? "") } : null,
    refund: refund ? { id: String(refund.id), amount: moneyNumber(refund.amount) ?? 0, status: String(refund.status ?? "pending"), triggerType: String(refund.trigger_type ?? ""), bankAccountId: stringValue(refund.umkm_bank_account_id) } : null,
    serverTime: serverNow,
  };
}

export function buildOrderSummary(items: UmkmOrderListItem[]) {
  return {
    total: items.length,
    pendingPayment: items.filter((item) => item.status === "pending_payment").length,
    paidReady: items.filter((item) => item.status === "paid" && ["ready_for_pickup", "paid_waiting_ready"].includes(item.phase)).length,
    pickedUp: items.filter((item) => item.status === "picked_up" || item.status === "completed").length,
    refund: items.filter((item) => item.status === "refund_pending" || item.status === "refunded").length,
  };
}
