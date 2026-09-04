export type AccountOrderStatus =
  | "registered"
  | "pending_payment"
  | "paid"
  | "picked_up"
  | "no_show"
  | "cancelled";

/** Lightweight order record shown in the "Pesanan" center (mock feed). */
export interface AccountOrder {
  id: string;
  batchId: string;
  batchTitle: string;
  batchDisplayCode: string;
  role: "buyer" | "supplier";
  counterparty: string;
  quantity: number;
  unit: string;
  finalAmount: number;
  status: AccountOrderStatus;
  lockedTier: number | null;
  createdAt: string;
  pickupUrl?: string;
}