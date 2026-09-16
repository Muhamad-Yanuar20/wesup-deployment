import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => {
  class SupabaseAdminConfigurationError extends Error {
    constructor() {
      super("Missing Supabase admin key configuration.");
      this.name = "SupabaseAdminConfigurationError";
    }
  }
  return { getAdminClient: vi.fn(), SupabaseAdminConfigurationError };
});
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/payments/midtrans", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/midtrans")>("@/lib/payments/midtrans");
  return { ...actual, getTransactionStatus: vi.fn() };
});

import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { getTransactionStatus, MidtransProviderError } from "@/lib/payments/midtrans";
import { POST } from "@/app/api/umkm/orders/[orderId]/payment/reconcile/route";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

function setup() {
  const paymentQuery = chain({ data: { id: "pay-1", status: "pending", midtrans_order_id: "WESUP-legacy", gross_amount: 120000, registration: { id: ORDER_ID, status: "pending_payment" } }, error: null });
  const attemptQuery = chain({ data: { id: "attempt-1", payment_id: "pay-1", provider_order_id: "WESUP-snap-1", status: "pending", integration_type: "snap", provider_status: "pending", expires_at: "2099-09-15T00:00:00.000Z" }, error: null });
  const rpc = vi.fn(async () => ({ data: { local_status: "paid", escrow_status: "held" }, error: null }));
  const admin = { from: vi.fn((table: string) => table === "payment_attempts" ? attemptQuery : paymentQuery), rpc };
  const client = { from: vi.fn(() => paymentQuery) };
  vi.mocked(resolveActiveUmkm).mockResolvedValue({ client, context: { userId: USER_ID, role: "umkm", status: "active" } as never, response: null });
  vi.mocked(getAdminClient).mockReturnValue(admin as never);
  return { admin, rpc };
}

describe("UMKM Snap payment reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats Midtrans 404 before method selection as pending", async () => {
    setup();
    vi.mocked(getTransactionStatus).mockRejectedValue(new MidtransProviderError("not found", 404, false));
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "pending", reconciled: false }));
  });

  it("applies successful provider events through the atomic Snap RPC", async () => {
    const { admin, rpc } = setup();
    vi.mocked(getTransactionStatus).mockResolvedValue({ orderId: "WESUP-snap-1", transactionId: "tx-1", transactionStatus: "settlement", qrCodeUrl: null, expiresAt: null, raw: { order_id: "WESUP-snap-1" } });
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    expect(getTransactionStatus).toHaveBeenCalledWith("WESUP-snap-1");
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_payment_attempt_id: "attempt-1", p_provider_status: "settlement", p_provider_transaction_id: "tx-1" }));
    expect(admin.from).toHaveBeenCalledWith("payment_attempts");
  });

  it("materializes the order after an active Snap attempt expires", async () => {
    const { rpc } = setup();
    rpc.mockImplementation((async (name?: string) => name === "materialize_umkm_order"
      ? { data: "cancelled", error: null }
      : { data: { registration_status: "pending_payment" }, error: null }) as never);
    vi.mocked(getTransactionStatus).mockResolvedValue({ orderId: "WESUP-snap-1", transactionId: "tx-expire", transactionStatus: "expire", qrCodeUrl: null, expiresAt: null, raw: { order_id: "WESUP-snap-1" } });
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_provider_status: "expire" }));
    expect(rpc).toHaveBeenCalledWith("materialize_umkm_order", { p_registration_id: ORDER_ID });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "expire", localStatus: "cancelled", reconciled: true }));
  });

  it("returns a typed configuration error when the admin client is unavailable", async () => {
    setup();
    vi.mocked(getAdminClient).mockImplementation(() => { throw new SupabaseAdminConfigurationError(); });
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "PAYMENT_ADMIN_CONFIG_MISSING", requestId: expect.any(String) }));
    expect(response.status).toBe(503);
    expect(getTransactionStatus).not.toHaveBeenCalled();
  });
});
