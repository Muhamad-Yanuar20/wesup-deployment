import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ requireRole: vi.fn(), toAuthResponse: vi.fn() }));
vi.mock("@/lib/transactions/offer-context", () => ({ getOfferContext: vi.fn() }));
import { getServerClient } from "@/lib/supabase/server";
import { getOfferContext } from "@/lib/transactions/offer-context";
import { POST } from "@/app/api/suppliers/batches/[id]/ready/route";
import { GET } from "@/app/api/suppliers/batches/[id]/orders/route";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.clearAllMocks());
it("calls readiness RPC on its owning Supabase client", async () => {
  const client = { bound: true, async rpc() { if (!this.bound) throw new Error("Detached client method"); return { error: null }; } };
  vi.mocked(getServerClient).mockResolvedValue(client as never);
  const response = await POST(new Request(`http://localhost/api/suppliers/batches/${id}/ready`, { method: "POST" }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
});
it("carries the promised unit into supplier handover rows", async () => {
  const client = { rpc: vi.fn(async (name: string) => ({ error: null, data: name === "list_batch_orders" ? [{ registration_id: id, quantity: 3, status: "paid" }] : null })) };
  vi.mocked(getServerClient).mockResolvedValue(client as never);
  vi.mocked(getOfferContext).mockResolvedValue({ policyVersion: 2, unit: "kg", pickupActions: [{ registrationId: id, canConfirm: true }] } as never);
  const response = await GET(new Request(`http://localhost/api/suppliers/batches/${id}/orders`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect((await response.json()).orders[0]).toMatchObject({ quantity: 3, unit: "kg", can_confirm_pickup: true });
});
