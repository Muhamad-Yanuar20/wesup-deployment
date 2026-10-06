export interface EarlyPaymentProposal {
  id: string;
  revision: number;
  minimumQuantity: number;
  status: "pending" | "rejected" | "cancelled" | "expired" | "closed";
  decision: "accepted" | "rejected" | null;
}

export interface EarlyPaymentContext {
  minimumQuantity: number | null;
  originalMinimumQuantity?: number | null;
  registeredQuantity: number;
  participants: number;
  accepted: number;
  rejected: number;
  hasParticipantHistory: boolean;
  canConfigure: boolean;
  canPropose: boolean;
  canOpen: boolean;
  canDecide: boolean;
  reason: string | null;
  tierNumber: number | null;
  unitPrice: number | null;
  proposal: EarlyPaymentProposal | null;
}

export function validateEarlyPaymentTarget(value: unknown, capacity: number): string | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= capacity
    ? null : "Isi target minimum berupa bilangan bulat antara 1 dan kapasitas maksimum.";
}

export function earlyPaymentEligibility(input: {
  open: boolean; withinWindow: boolean; volume: number; minimum: number | null;
  participants: number; accepted: number; rejected: number; requiresApproval: boolean;
}): { allowed: boolean; reason: string | null } {
  if (!input.open || !input.withinWindow) return { allowed: false, reason: "Pengumpulan sudah ditutup atau belum dibuka." };
  if (!input.minimum || input.volume < input.minimum || input.participants < 1) return { allowed: false, reason: "Target minimum belum tercapai." };
  if (input.requiresApproval && (input.rejected > 0 || input.accepted !== input.participants)) return { allowed: false, reason: "Menunggu persetujuan seluruh peserta aktif." };
  return { allowed: true, reason: null };
}
