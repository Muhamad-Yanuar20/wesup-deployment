import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => {
  class SupabaseAdminConfigurationError extends Error {
    constructor() {
      super("Missing Supabase admin key configuration.");
      this.name = "SupabaseAdminConfigurationError";
    }
  }
  return { getAdminClient: vi.fn(), SupabaseAdminConfigurationError };
});
vi.mock("@/lib/payments/midtrans-signature", () => ({ verifyMidtransSignature: vi.fn(() => true) }));

import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { POST } from "@/app/api/webhook/midtrans/route";

const ORDER_ID = "WESUP-111111111111411181111111111111-1";

function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.insert = vi.fn(async () => ({ data: null, error: null }));
  builder.update = vi.fn(() => builder);
  return builder;
}

function setup() {
  const attemptQuery = chain({ data: { id: "attempt-1", payment_id: "pay-1", provider_order_id: ORDER_ID, status: "pending", payment: { id: "pay-1", registration_id: "reg-1", gross_amount: 120000, status: "pending" } }, error: null });
  const logs = chain({ data: null, error: null });
  const rpc = vi.fn(async () => ({ data: { registration_status: "paid", escrow_status: "held" }, error: null }));
  const admin = { from: vi.fn((table: string) => table === "payment_attempts" ? attemptQuery : logs), rpc };
  vi.mocked(getAdminClient).mockReturnValue(admin as never);
  return { admin, rpc };
}

describe("Midtrans Snap webhook", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.MIDTRANS_SERVER_KEY = "sandbox-key"; });

  it("looks up Snap attempts and applies the shared payment event RPC", async () => {
    const { admin, rpc } = setup();
    const response = await POST(new Request("http://localhost/api/webhook/midtrans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: ORDER_ID, transaction_id: "tx-1", transaction_status: "settlement", status_code: "200", gross_amount: "120000", signature_key: "signature", payment_type: "qris", settlement_time: "2026-09-16 08:00:00" }) }));
    expect(response.status).toBe(200);
    expect(admin.from).toHaveBeenCalledWith("payment_attempts");
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_payment_attempt_id: "attempt-1", p_provider_status: "settlement", p_payment_type: "qris" }));
  });

  it("does not finalize capture with a non-accepted fraud status", async () => {
    const { rpc } = setup();
    const response = await POST(new Request("http://localhost/api/webhook/midtrans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: ORDER_ID, transaction_id: "tx-1", transaction_status: "capture", status_code: "200", gross_amount: "120000", signature_key: "signature", fraud_status: "challenge" }) }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_provider_status: "capture", p_fraud_status: "challenge" }));
  });

  it("retries a webhook whose prior log was not processed", async () => {
    const attemptQuery = chain({ data: { id: "attempt-1", payment_id: "pay-1", provider_order_id: ORDER_ID, status: "pending", payment: { id: "pay-1", registration_id: "reg-1", gross_amount: 120000, status: "pending" } }, error: null });
    const logs = chain({ data: { id: "log-1", status: "received" }, error: null });
    logs.insert = vi.fn(async () => ({ data: null, error: { code: "23505" } }));
    const rpc = vi.fn(async () => ({ data: { registration_status: "paid", escrow_status: "held" }, error: null }));
    const admin = { from: vi.fn((table: string) => table === "payment_attempts" ? attemptQuery : logs), rpc };
    vi.mocked(getAdminClient).mockReturnValue(admin as never);

    const response = await POST(new Request("http://localhost/api/webhook/midtrans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: ORDER_ID, transaction_id: "tx-retry", transaction_status: "settlement", status_code: "200", gross_amount: "120000", signature_key: "signature", payment_type: "qris", settlement_time: "2026-09-16 08:00:01" }) }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_payment_attempt_id: "attempt-1" }));
    expect(logs.update).toHaveBeenCalledWith(expect.objectContaining({ status: "processed", error_message: null }));
  });

  it("returns a typed configuration error when the webhook admin client is unavailable", async () => {
    vi.mocked(getAdminClient).mockImplementation(() => { throw new SupabaseAdminConfigurationError(); });
    const response = await POST(new Request("http://localhost/api/webhook/midtrans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: ORDER_ID, transaction_id: "tx-config", transaction_status: "pending", status_code: "201", gross_amount: "120000", signature_key: "signature" }) }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "PAYMENT_ADMIN_CONFIG_MISSING", requestId: expect.any(String) }));
    expect(response.status).toBe(503);
  });
});
