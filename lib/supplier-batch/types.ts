import type { BatchCategory } from "@/lib/catalog/categories";

export type AsyncPhase = "idle" | "loading" | "success" | "error";

export type SupplierBatchStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED_BY_SUPPLIER" | "TAKEDOWN" | "COMPLETED";

export interface SupplierBatchTier {
  tierNumber: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  pricePerUnit: number;
}

export interface SupplierBatchTimeline {
  registrationOpensAt: string;
  registrationClosesAt: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
  estimatedReadyAt: string;
  effectivePaymentOpensAt?: string | null;
  effectivePaymentClosesAt?: string | null;
}

export interface SupplierBatchPickup {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SupplierBatchCancellation {
  reason: string;
  actor: "SUPPLIER";
  cancelledAt: string;
}

export interface SupplierBatchDetail {
  policyVersion?:number;commercialLocked?:boolean;
  id: string;
  displayCode: string;
  title: string;
  supplierName: string;
  category: BatchCategory;
  imageUrl: string;
  description: string;
  status: SupplierBatchStatus;
  basePrice: number;
  targetQuantity: number;
  capacityQuantity?: number;
  unit?: "kg" | "gram" | "liter" | "ml" | "pcs" | "pack" | "karung" | "ikat" | "sisir";
  paymentWindowHours?: 3 | 6 | 12 | 24;
  registrationClosedAt?: string | null;
  closeReason?: string | null;
  finalRegisteredQuantity?: number | null;
  lockedTierNumber?: number | null;
  lockedUnitPrice?: number | null;
  invoicesIssuedAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  registeredQuantity: number;
  participantCount: number;
  paidParticipantCount: number;
  tiers: readonly SupplierBatchTier[];
  timeline: SupplierBatchTimeline;
  pickup: SupplierBatchPickup;
  cancellation: SupplierBatchCancellation | null;
}

export interface SupplierBatchCancellationInput {
  reason: string;
}

export interface SupplierBatchRepository {
  getById(id: string, options?: { signal?: AbortSignal }): Promise<SupplierBatchDetail | null>;
  cancel(
    id: string,
    input: SupplierBatchCancellationInput,
    options?: { signal?: AbortSignal },
  ): Promise<SupplierBatchDetail>;
}
