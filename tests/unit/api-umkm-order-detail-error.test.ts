import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));

import { getServerClient } from "@/lib/supabase/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { GET } from "@/app/api/umkm/orders/[orderId]/route";

const mockGetServerClient = vi.mocked(getServerClient);
const mockResolveActiveUmkm = vi.mocked(resolveActiveUmkm);
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("UMKM order detail read errors", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    mockResolveActiveUmkm.mockReset();
  });

  it("logs a safe request reference when the detail read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = {
        maybeSingle: vi.fn(async () => ({
          data: null,
          error: { code: "PGRST201", message: "ambiguous relationship details" },
        })),
        eq: vi.fn(),
      };
      result.eq.mockReturnValue(result);
      const query = { select: vi.fn(() => result) };
      mockResolveActiveUmkm.mockResolvedValue({
        client: { from: vi.fn(() => query) },
        context: { userId: "22222222-2222-4222-8222-222222222222", role: "umkm", status: "active" },
        response: null,
      } as never);

      const response = await GET(new Request(`http://localhost/api/umkm/orders/${ORDER_ID}`), { params: Promise.resolve({ orderId: ORDER_ID }) });
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual(expect.objectContaining({ requestId: expect.any(String) }));
      expect(log).toHaveBeenCalledWith("[umkm-orders] detail read failed", expect.objectContaining({ code: "PGRST201", requestId: body.requestId }));
      expect(JSON.stringify(log.mock.calls)).not.toContain("ambiguous relationship details");
    } finally {
      log.mockRestore();
    }
  });
});
