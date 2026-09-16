// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UmkmPaymentPanel from "@/components/payments/UmkmPaymentPanel";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { renderComponent as render } from "./test-utils";

vi.mock("@/components/payments/MidtransSnapLoader", () => ({
  __esModule: true,
  default: ({ onStateChange }: { onStateChange: (state: "ready") => void }) => {
    onStateChange("ready");
    return null;
  },
}));

const baseOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  batchId: "22222222-2222-4222-8222-222222222222",
  batchTitle: "Kentang Granola",
  batchDisplayCode: "BATCH-22222222",
  supplierName: "PT Agri Sejahtera",
  batchStatus: "closed",
  quantity: 80,
  unit: "kg",
  status: "pending_payment",
  phase: "payment_open",
  finalAmount: 2800000,
  lockedTier: 3,
  createdAt: "2026-09-15T00:00:00.000Z",
  timeline: {
    registrationClosesAt: "2026-09-15T00:00:00.000Z",
    paymentOpensAt: "2026-09-16T00:00:00.000Z",
    paymentClosesAt: "2026-09-17T00:00:00.000Z",
    estimatedReadyAt: "2026-09-18T00:00:00.000Z",
    pickupDeadlineAt: "2026-09-18T12:00:00.000Z",
    complaintDeadlineAt: null,
  },
  capabilities: { canPay: true, canViewPickup: false, canComplain: false, canTrackDispute: false, canRate: false, canSubmitRefundAccount: false },
  paymentStatus: "pending",
  pickupConfirmedAt: null,
  invoice: { paymentId: "pay-1", grossAmount: 2800000, status: "pending", midtransOrderId: "WESUP-1", qrCodeUrl: null, qrCodeExpiresAt: null, paidAt: null },
  pickup: null,
  escrow: null,
  dispute: null,
  rating: null,
  refund: null,
  serverTime: "2026-09-16T01:00:00.000Z",
} satisfies Omit<UmkmOrderDetail, "paymentAttempt">;

describe("UmkmPaymentPanel", () => {
  it("explains that a created checkout still needs a method", () => {
    render(<UmkmPaymentPanel order={{ ...baseOrder, paymentAttempt: { id: "attempt-1", providerOrderId: "WESUP-1", status: "pending", checkoutMode: "snap", providerStatus: "pending", paymentMethod: null, qrCodeUrl: null, expiresAt: "2026-09-17T00:00:00.000Z" } }} onReload={vi.fn()} snapConfig={{ clientKey: "client", scriptUrl: "https://example.test/snap.js", nonce: null }} />);
    expect(screen.getByText("Checkout sudah dibuat")).toBeInTheDocument();
    expect(screen.getByText(/metode pembayaran belum selesai dipilih/i)).toBeInTheDocument();
    expect(screen.queryByText(/Status provider/i)).not.toBeInTheDocument();
  });

  it("shows a friendly confirmed method only when payment_type exists", () => {
    render(<UmkmPaymentPanel order={{ ...baseOrder, paymentAttempt: { id: "attempt-1", providerOrderId: "WESUP-1", status: "pending", checkoutMode: "snap", providerStatus: "pending", paymentMethod: "qris", qrCodeUrl: null, expiresAt: "2026-09-17T00:00:00.000Z" } }} onReload={vi.fn()} snapConfig={{ clientKey: "client", scriptUrl: "https://example.test/snap.js", nonce: null }} />);
    expect(screen.getByText("Menunggu pembayaran")).toBeInTheDocument();
    expect(screen.getByText("Metode dipilih: QRIS")).toBeInTheDocument();
  });
});
