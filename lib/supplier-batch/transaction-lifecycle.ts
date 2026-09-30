import { resolveTierForVolume, type Tier } from "@/lib/orders/time-gatekeeper";

export type SupplierBatchCloseTrigger =
  | "capacity_reached"
  | "registration_expired"
  | "supplier_manual";

export type SupplierBatchCloseStatus = "draft" | "published" | "closed" | "cancelled" | "takedown" | "completed";

export interface SupplierBatchCloseInput {
  status: SupplierBatchCloseStatus;
  trigger: SupplierBatchCloseTrigger;
  now: string;
  registrationClosesAt: string;
  registeredQuantity: number;
  minimumQuantity: number;
  capacityQuantity: number | null;
  paymentWindowHours: number;
}

export type SupplierBatchCloseReason =
  | "batch_not_open"
  | "minimum_not_reached"
  | "capacity_not_reached"
  | "registration_still_open"
  | "invalid_payment_window"
  | "invalid_capacity";

export interface SupplierBatchCloseDecision {
  allowed: true;
  closeAt: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
}

export interface SupplierBatchCloseRejection {
  allowed: false;
  reason: SupplierBatchCloseReason;
  closeAt?: string;
  paymentOpensAt?: string;
  paymentClosesAt?: string;
}

export function evaluateSupplierBatchClose(
  input: SupplierBatchCloseInput,
): SupplierBatchCloseDecision | SupplierBatchCloseRejection {
  if (input.status !== "published") return { allowed: false, reason: "batch_not_open" };
  if (![3, 6, 12, 24].includes(input.paymentWindowHours)) {
    return { allowed: false, reason: "invalid_payment_window" };
  }
  if (input.capacityQuantity !== null && (!Number.isSafeInteger(input.capacityQuantity) || input.capacityQuantity <= 0)) {
    return { allowed: false, reason: "invalid_capacity" };
  }

  const nowMs = Date.parse(input.now);
  const cutoffMs = Date.parse(input.registrationClosesAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(cutoffMs)) {
    return { allowed: false, reason: "registration_still_open" };
  }

  if (input.trigger === "supplier_manual") {
    if (input.registeredQuantity < input.minimumQuantity) {
      return { allowed: false, reason: "minimum_not_reached" };
    }
    if (nowMs >= cutoffMs) return { allowed: false, reason: "registration_still_open" };
  }
  if (input.trigger === "capacity_reached" && input.capacityQuantity !== null && input.registeredQuantity < input.capacityQuantity) {
    return { allowed: false, reason: "capacity_not_reached" };
  }
  if (input.trigger === "registration_expired" && nowMs < cutoffMs) {
    return { allowed: false, reason: "registration_still_open" };
  }

  const closeAtMs = input.trigger === "registration_expired" ? cutoffMs : nowMs;
  const paymentClosesAtMs = closeAtMs + input.paymentWindowHours * 60 * 60 * 1_000;
  return {
    allowed: true,
    closeAt: new Date(closeAtMs).toISOString(),
    paymentOpensAt: new Date(closeAtMs).toISOString(),
    paymentClosesAt: new Date(paymentClosesAtMs).toISOString(),
  };
}

export function resolveSupplierTier(tiers: readonly Tier[], totalVolume: number): Tier {
  return resolveTierForVolume([...tiers], Math.max(0, totalVolume));
}
