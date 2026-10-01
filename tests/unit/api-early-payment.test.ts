import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as configure } from "@/app/api/suppliers/batches/[id]/early-payment/route";
import { POST as close } from "@/app/api/suppliers/batches/[id]/close/route";
import { POST as decide } from "@/app/api/umkm/orders/[orderId]/early-payment-decision/route";

const { rpc, lock, resolve, client } = vi.hoisted(() => {
  const rpc = vi.fn(); const lock = vi.fn(async (_: string, operation: () => Promise<unknown>) => operation());
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { batch_id: "44444444-4444-4444-8444-444444444444" }, error: null })) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  const client = { rpc, from: vi.fn(() => query) };
  const resolve = vi.fn(async () => ({ client, context: { userId: "buyer", status: "suspended_temporary" }, response: null }));
  return { rpc, lock, resolve, client };
});
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn(async () => client) }));
vi.mock("@/lib/supabase/auth", () => ({ requireRole: vi.fn(async () => ({ userId: "owner" })), toAuthResponse: vi.fn() }));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: resolve }));
vi.mock("@/lib/transactions/registration", () => ({ withRegistrationLock: lock }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
const id = "44444444-4444-4444-8444-444444444444", proposal = "55555555-5555-4555-8555-555555555555";
const request = (body: unknown) => new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { rpc.mockReset(); lock.mockClear(); resolve.mockClear(); rpc.mockResolvedValue({ data: { canOpen: false }, error: null }); });
describe("early payment route contracts", () => {
  it("locks target/proposal configuration by batch and preserves the request identity", async () => {
    const response = await configure(request({ minimumQuantity: 40, requestId: proposal }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(lock).toHaveBeenCalledWith(id, expect.any(Function));
    expect(rpc).toHaveBeenCalledWith("configure_early_payment", { p_batch_id: id, p_minimum: 40, p_request_id: proposal });
  });
  it.each([0, 1.5, "40", null])("rejects invalid target %s before RPC", async value => {
    expect((await configure(request({ minimumQuantity: value, requestId: proposal }), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("cancels only the reviewed proposal revision", async () => {
    await configure(request({ action: "cancel", proposalId: proposal, revision: 2 }), { params: Promise.resolve({ id }) });
    expect(rpc).toHaveBeenCalledWith("cancel_early_payment_proposal", { p_batch_id: id, p_proposal_id: proposal, p_revision: 2 });
  });
  it("passes the complete price/volume confirmation through the guarded close RPC", async () => {
    const confirmation = { registeredQuantity: 40, participants: 2, tierNumber: 2, unitPrice: 8000, proposalId: proposal, proposalRevision: 2 };
    await close(request({ confirmation }), { params: Promise.resolve({ id }) });
    expect(rpc).toHaveBeenCalledWith("confirm_early_payment_close", expect.objectContaining({ p_confirmation: confirmation }));
  });
  it("rejects stale confirmation without exposing SQL text", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "confirmation changed sql internal" } });
    const response = await close(request({ confirmation: {} }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).not.toMatch(/sql|draft/i);
  });
  it("allows suspended-order recovery and records exactly the chosen decision", async () => {
    const response = await decide(request({ proposalId: proposal, revision: 2, decision: "rejected" }), { params: Promise.resolve({ orderId: id }) });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith({ allowSuspended: true });
    expect(rpc).toHaveBeenCalledWith("decide_early_payment", { p_registration_id: id, p_proposal_id: proposal, p_revision: 2, p_decision: "rejected" });
  });
  it("does not retry a lost mutation response", async () => {
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    const response = await configure(request({ minimumQuantity: 40, requestId: proposal }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(503); expect(rpc).toHaveBeenCalledTimes(1);
    expect((await response.json()).error).toMatch(/belum dapat dipastikan/);
  });
});
