import type { OfferContext } from "@/lib/transactions/offer-context";
export type SupplierTransactionOrderStatus = "registered" | "pending_payment" | "paid" | "picked_up" | "completed" | "no_show" | "cancelled" | "refund_pending" | "refunded";

export interface SupplierTransactionOrder {
  canConfirmPickup?: boolean;
  registrationId: string;
  umkmId: string;
  umkmName: string;
  quantity: number;
  status: SupplierTransactionOrderStatus;
  finalAmount: number | null;
  lockedTierNumber: number | null;
  lockedPricePerUnit: number | null;
  createdAt: string;
  paymentStatus: string | null;
  escrowStatus: string | null;
  pickupConfirmedAt: string | null;
  autoReleaseAt: string | null;
}

export interface SupplierTransactionSummary {
  registered: number;
  pendingPayment: number;
  paid: number;
  pickedUp: number;
  failed: number;
  refund: number;
  totalQuantity: number;
  totalAmount: number;
}

export interface SupplierCapabilities {
  canEditCommercialFields: boolean;
  canCloseBatch: boolean;
  canCancelBatch: boolean;
  canMarkReady: boolean;
  canConfirmPickup: boolean;
  canViewDispute: boolean;
  canRequestPayout: boolean;
}

export interface SupplierBatchTransactionSnapshot {
  offerContext?:OfferContext|null;
  batch: Record<string, unknown>;
  timeline: Record<string, unknown>;
  capacityQuantity: number | null;
  paymentWindowHours: number;
  registrationClosedAt: string | null;
  closeReason: string | null;
  finalRegisteredQuantity: number | null;
  lockedTierNumber: number | null;
  lockedUnitPrice: number | null;
  invoicesIssuedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  summary: SupplierTransactionSummary;
  capabilities: SupplierCapabilities;
  orders: SupplierTransactionOrder[];
  serverTime: string;
}

export function parseSupplierBatchTransaction(value: unknown): SupplierBatchTransactionSnapshot {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const summaryInput = input.summary && typeof input.summary === "object" ? input.summary as Record<string, unknown> : {};
  const capabilitiesInput = input.capabilities && typeof input.capabilities === "object" ? input.capabilities as Record<string, unknown> : {};
  const orders = Array.isArray(input.orders) ? input.orders.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      canConfirmPickup: typeof row.canConfirmPickup === "boolean" ? row.canConfirmPickup : undefined,
      registrationId: String(row.registrationId ?? ""), umkmId: String(row.umkmId ?? ""), umkmName: String(row.umkmName ?? "UMKM"),
      quantity: number(row.quantity), status: String(row.status ?? "registered") as SupplierTransactionOrderStatus,
      finalAmount: nullableNumber(row.finalAmount), lockedTierNumber: nullableNumber(row.lockedTierNumber), lockedPricePerUnit: nullableNumber(row.lockedPricePerUnit),
      createdAt: String(row.createdAt ?? ""), paymentStatus: row.paymentStatus == null ? null : String(row.paymentStatus), escrowStatus: row.escrowStatus == null ? null : String(row.escrowStatus),
      pickupConfirmedAt: row.pickupConfirmedAt == null ? null : String(row.pickupConfirmedAt), autoReleaseAt: row.autoReleaseAt == null ? null : String(row.autoReleaseAt),
    };
  }) : [];
  return {
    offerContext:input.offerContext as OfferContext|null,
    batch: input.batch && typeof input.batch === "object" ? input.batch as Record<string, unknown> : {},
    timeline: input.timeline && typeof input.timeline === "object" ? input.timeline as Record<string, unknown> : {},
    capacityQuantity: nullableNumber(input.capacityQuantity), paymentWindowHours: number(input.paymentWindowHours, 24),
    registrationClosedAt: nullableString(input.registrationClosedAt), closeReason: nullableString(input.closeReason), finalRegisteredQuantity: nullableNumber(input.finalRegisteredQuantity),
    lockedTierNumber: nullableNumber(input.lockedTierNumber), lockedUnitPrice: nullableNumber(input.lockedUnitPrice), invoicesIssuedAt: nullableString(input.invoicesIssuedAt), readyAt: nullableString(input.readyAt), completedAt: nullableString(input.completedAt),
    summary: { registered: number(summaryInput.registered), pendingPayment: number(summaryInput.pendingPayment), paid: number(summaryInput.paid), pickedUp: number(summaryInput.pickedUp), failed: number(summaryInput.failed), refund: number(summaryInput.refund), totalQuantity: number(summaryInput.totalQuantity), totalAmount: number(summaryInput.totalAmount) },
    capabilities: {
      canEditCommercialFields: Boolean(capabilitiesInput.canEditCommercialFields),
      canCloseBatch: Boolean(capabilitiesInput.canCloseBatch),
      canCancelBatch: Boolean(capabilitiesInput.canCancelBatch),
      canMarkReady: Boolean(capabilitiesInput.canMarkReady),
      canConfirmPickup: Boolean(capabilitiesInput.canConfirmPickup),
      canViewDispute: Boolean(capabilitiesInput.canViewDispute),
      canRequestPayout: Boolean(capabilitiesInput.canRequestPayout),
    },
    orders, serverTime: String(input.serverTime ?? new Date().toISOString()),
  };
}

function number(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNumber(value: unknown) { return value == null || !Number.isFinite(Number(value)) ? null : Number(value); }
function nullableString(value: unknown) { return typeof value === "string" && value ? value : null; }
