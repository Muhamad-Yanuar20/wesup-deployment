import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { GET as listOrders } from "@/app/api/umkm/orders/route";
import { GET as getOrder } from "@/app/api/umkm/orders/[orderId]/route";

const id = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const row = { id, batch_id: id, quantity: 2, status: "paid", final_amount: 20000,
  locked_tier_number: 1, created_at: "2026-09-01T00:00:00Z",
  batch: { id, title: "Pesanan lama", unit: "kg", status: "closed", batch_timeline: null } };
const missingReplacement = { code: "PGRST200", message: "Could not find a relationship between 'batches' and 'pickup_replacements' in the schema cache" };

function setup(error: unknown = missingReplacement, fallbackError: unknown = null) {
  const eq = vi.fn();
  const select = vi.fn((projection: string) => {
    const legacy = !projection.includes("transaction_policy_version");
    const result = { data: legacy && !fallbackError ? [row] : null, error: legacy ? fallbackError : error };
    const query = { eq, then: Promise.resolve(result).then.bind(Promise.resolve(result)),
      maybeSingle: async () => ({ ...result, data: result.data?.[0] ?? null }) };
    eq.mockReturnValue(query);
    return query;
  });
  vi.mocked(resolveActiveUmkm).mockResolvedValue({ client: { from: () => ({ select }) },
    context: { userId: owner, role: "umkm", status: "active" }, response: null } as never);
  return { select, eq };
}

describe("orders during transaction schema rollout", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps legacy orders accessible without enabling new policy actions", async () => {
    const { select, eq } = setup();
    const response = await listOrders(new Request("http://localhost/api/umkm/orders?limit=20"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders[0]).toMatchObject({ id, finalAmount: 20000, policyVersion: 1 });
    expect(body.orders[0].capabilities.canWithdraw).toBeFalsy();
    expect(body.orders[0].capabilities.canChoosePickup).toBeFalsy();
    expect(select).toHaveBeenCalledTimes(2);
    expect(eq).toHaveBeenCalledWith("umkm_id", owner);
    expect(select.mock.calls[1][0]).not.toMatch(/pickup_replacements|cancellation_reason|accepted_pickup_revision|pickup_ends_at/);
  });
  it("recovers the same owned detail when an added column is absent", async () => {
    const { eq } = setup({ code: "42703", message: "column registrations.cancellation_reason does not exist" });
    const response = await getOrder(new Request(`http://localhost/api/umkm/orders/${id}`), { params: Promise.resolve({ orderId: id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, finalAmount: 20000, policyVersion: 1 });
    expect(eq).toHaveBeenCalledWith("id", id);
    expect(eq).toHaveBeenCalledWith("umkm_id", owner);
  });
  it("does not hide unrelated relationship failures behind compatibility", async () => {
    const { select } = setup({ code: "PGRST200", message: "Could not find relationship payments and escrow_holds" });
    const response = await listOrders(new Request("http://localhost/api/umkm/orders"));
    expect(response.status).toBe(503);
    expect(select).toHaveBeenCalledTimes(1);
    expect((await response.json()).code).toBe("ORDERS_READ_FAILED");
  });
  it("preserves a failed fallback as an error instead of an empty order list", async () => {
    setup(missingReplacement, { code: "42501", message: "permission denied" });
    const response = await listOrders(new Request("http://localhost/api/umkm/orders"));
    expect(response.status).toBe(503);
    expect((await response.json()).orders).toBeUndefined();
  });
  it("preserves the deployed refund finalization fix in the payment migration", () => {
    const sql = readFileSync("supabase/migrations/20260930010000_payment_event_log_execution.sql", "utf8");
    expect(sql).toMatch(/where id = v_registration.id and status in \('registered', 'pending_payment', 'cancelled', 'paid'\)/);
  });
});
