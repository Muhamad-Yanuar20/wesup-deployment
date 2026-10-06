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
vi.mock("@/lib/payments/order-lock", () => ({
  acquirePaymentLock: vi.fn(async () => ({ acquired: true, token: "lock-token" })),
  releasePaymentLock: vi.fn(async () => undefined),
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/payments/midtrans", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/midtrans")>("@/lib/payments/midtrans");
  return { ...actual, createSnapTransaction: vi.fn() };
});

import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { createSnapTransaction } from "@/lib/payments/midtrans";
import { POST } from "@/app/api/umkm/orders/[orderId]/payment/charge/route";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function chain<T>(result: T) {
  const builder: Record<string, unknown> = {};
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.insert = vi.fn(async () => result);
  builder.update = vi.fn(() => builder);
  return builder;
}

function setup(options: { activeAttempt?: Record<string, unknown> | null; activeAttemptError?: unknown; paymentInsert?: Record<string, unknown> | null } = {}) {
  const registration = chain({
    data: {
      id: ORDER_ID,
      quantity: 1,
      status: "pending_payment",
      final_amount: 120000,
      batch: {
        batch_timeline: {
          payment_opens_at: "2026-09-15T00:00:00.000Z",
          payment_closes_at: "2099-09-15T00:00:00.000Z",
          effective_payment_opens_at: "2026-09-15T00:00:00.000Z",
          effective_payment_closes_at: "2099-09-15T00:00:00.000Z",
        },
      },
      payment: { id: "pay-1", midtrans_order_id: "WESUP-legacy", gross_amount: 120000, status: "pending", qr_code_url: null, qr_code_expires_at: null },
    },
    error: null,
  });
  const attempt = chain({ data: options.activeAttempt ?? null, error: options.activeAttemptError ?? null });
  const payments = chain({ data: options.paymentInsert ?? null, error: null });
  const admin = {
    from: vi.fn((table: string) => table === "payment_attempts" ? attempt : payments),
  };
  const client = { from: vi.fn(() => registration), rpc: vi.fn(async () => ({ data: null, error: null })) };
  vi.mocked(resolveActiveUmkm).mockResolvedValue({ client, context: { userId: USER_ID, role: "umkm", status: "active" } as never, response: null });
  vi.mocked(getAdminClient).mockReturnValue(admin as never);
  return { admin, attempt, registration, payments, client };
}

describe("UMKM Snap payment charge", () => {
  it("never treats an unreadable attempt relation as permission to create another bill",async()=>{
    setup({activeAttemptError:{code:"PGRST200",message:"schema relationship unavailable"}});
    const response=await POST(new NextRequest("http://localhost/api/umkm/orders/"+ORDER_ID+"/payment/charge",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:"PAYMENT_ATTEMPT_READ_FAILED"});expect(createSnapTransaction).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSnapTransaction).mockImplementation(async (input) => ({ orderId: input.orderId, token: "snap-token", redirectUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token", expiresAt: input.expiresAt, raw: {} }));
  });
  it('keeps an uncertain provider request pending for reconciliation',async()=>{
    const {attempt}=setup();vi.mocked(createSnapTransaction).mockRejectedValue(new Error('lost provider response'));
    const response=await POST(new NextRequest('http://localhost/api/umkm/orders/'+ORDER_ID+'/payment/charge',{method:'POST'}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(502);expect(attempt.update).toHaveBeenCalledWith(expect.objectContaining({status:'pending',provider_status:'creation_unknown'}));
  });
  it('does not replace an old unknown checkout with a second bill',async()=>{
    const {attempt}=setup({activeAttempt:{id:'attempt-1',provider_order_id:'WESUP-unknown',status:'pending',provider_status:'creating',integration_type:'snap',created_at:'2026-09-01T00:00:00Z',expires_at:'2099-09-15T00:00:00Z'}});
    const response=await POST(new NextRequest('http://localhost/api/umkm/orders/'+ORDER_ID+'/payment/charge',{method:'POST'}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(409);expect(createSnapTransaction).not.toHaveBeenCalled();expect(attempt.update).not.toHaveBeenCalled();
  });

  it("reuses an active Snap session and returns the token without charging twice", async () => {
    setup({ activeAttempt: { id: "attempt-1", provider_order_id: "WESUP-111111111111411181111111111111-1", status: "pending", integration_type: "snap", expires_at: "2099-09-15T00:00:00.000Z", payment_checkout_session: { snap_token: "existing-token", redirect_url: "https://checkout", expires_at: "2099-09-15T00:00:00.000Z" } } });
    const response = await POST(new NextRequest("http://localhost/api/umkm/orders/" + ORDER_ID + "/payment/charge", { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ attempt: expect.objectContaining({ checkoutMode: "snap", snapToken: "existing-token" }) }));
    expect(createSnapTransaction).not.toHaveBeenCalled();
  });

  it("creates a new Snap attempt with a unique provider order id", async () => {
    setup();
    const response = await POST(new NextRequest("http://localhost/api/umkm/orders/" + ORDER_ID + "/payment/charge", { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(201);
    expect(createSnapTransaction).toHaveBeenCalledWith(expect.objectContaining({ grossAmount: 120000, itemQuantity: 1, itemUnitPrice: 120000, expiresAt: "2099-09-15T00:00:00.000Z" }), expect.anything());
    const body = await response.json();
    expect(body).toMatchObject({paymentProgress:{state:"checkout_created",canOpenCheckout:true,canCheckStatus:true},lastCheckedAt:null,canOpenCheckout:true,canCheckStatus:true,blockedReason:null,lockedUnitPrice:120000});
    expect(Number.isNaN(Date.parse((body as { serverTime: string }).serverTime))).toBe(false);
    expect((body as { attempt: { expiresAt: string; qrCodeUrl: string | null } }).attempt.expiresAt).toBe("2099-09-15T00:00:00.000Z");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("rejects checkout during the final five minutes", async () => {
    const { registration } = setup();
    (registration.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: ORDER_ID,
        quantity: 1,
      status: "pending_payment",
        final_amount: 120000,
        batch: { batch_timeline: { payment_opens_at: "2026-09-15T00:00:00.000Z", payment_closes_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), effective_payment_opens_at: "2026-09-15T00:00:00.000Z", effective_payment_closes_at: new Date(Date.now() + 2 * 60 * 1000).toISOString() } },
        payment: { id: "pay-1", midtrans_order_id: "WESUP-legacy", gross_amount: 120000, status: "pending", qr_code_url: null, qr_code_expires_at: null },
      },
      error: null,
    });
    const response = await POST(new NextRequest("http://localhost/api/umkm/orders/" + ORDER_ID + "/payment/charge", { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "PAYMENT_CHECKOUT_CUTOFF" }));
    expect(createSnapTransaction).not.toHaveBeenCalled();
  });

  it("maps missing Supabase admin configuration separately from Midtrans failures", async () => {
    const { admin } = setup();
    vi.mocked(getAdminClient).mockImplementation(() => { throw new SupabaseAdminConfigurationError(); });
    const response = await POST(new NextRequest("http://localhost:3000/api/umkm/orders/" + ORDER_ID + "/payment/charge", { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual(expect.objectContaining({ code: "PAYMENT_ADMIN_CONFIG_MISSING", requestId: expect.any(String) }));
    expect(createSnapTransaction).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("maps unexpected Supabase admin initialization failures separately", async () => {
    const { admin } = setup();
    vi.mocked(getAdminClient).mockImplementation(() => { throw new Error("admin client failure"); });
    const response = await POST(new NextRequest("http://localhost:3000/api/umkm/orders/" + ORDER_ID + "/payment/charge", { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual(expect.objectContaining({ code: "PAYMENT_ADMIN_INIT_FAILED", requestId: expect.any(String) }));
    expect(createSnapTransaction).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});

describe("checkout continuation safeguards", () => {
  it("reuses a valid denied Snap session without issuing another payment", async () => {
    setup({activeAttempt:{id:"denied",status:"failed",provider_status:"deny",integration_type:"snap",expires_at:"2099-09-15T00:00:00Z",payment_checkout_sessions:{snap_token:"reusable",redirect_url:"https://checkout",expires_at:"2099-09-15T00:00:00Z"}}});
    const response=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({attempt:{snapToken:"reusable"}});expect(createSnapTransaction).not.toHaveBeenCalled();
  });
  it("does not create checkout when the invoice is already paid", async () => {
    const {registration}=setup();
    const result=await (registration.maybeSingle as () => Promise<{data:{payment:{status:string}}}>)();result.data.payment.status="paid";
    const response=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:"PAYMENT_ALREADY_RECORDED"});expect(createSnapTransaction).not.toHaveBeenCalled();
  });
});

describe("runtime payment materialization", () => {
  it("uses the same supplier-aware RPC under test and production", async () => {
    const {client}=setup();
    await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(client.rpc).toHaveBeenCalledWith("materialize_supplier_order",{p_registration_id:ORDER_ID});
  });
});
