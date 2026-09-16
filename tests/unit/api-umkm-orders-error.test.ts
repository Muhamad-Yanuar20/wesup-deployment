import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerClient } from "@/lib/supabase/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { GET } from "@/app/api/umkm/orders/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);
const mockResolveActiveUmkm = vi.mocked(resolveActiveUmkm);

describe("UMKM orders read errors", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    mockResolveActiveUmkm.mockReset();
  });

  it("returns a safe request id and logs the PostgREST code when the read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const query = {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: null,
            error: { code: "PGRST201", message: "ambiguous relationship details" },
          })),
        })),
      };
      mockResolveActiveUmkm.mockResolvedValue({
        client: { from: vi.fn(() => query) },
        context: { userId: "11111111-1111-4111-8111-111111111111", role: "umkm", status: "active" },
        response: null,
      } as never);

      const response = await GET(new Request("http://localhost/api/umkm/orders?limit=20"));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual(expect.objectContaining({
        code: "ORDERS_READ_FAILED",
        requestId: expect.any(String),
      }));
      expect(body.error).not.toContain("PGRST201");
      expect(log).toHaveBeenCalledWith("[umkm-orders] read failed", expect.objectContaining({ code: "PGRST201", requestId: body.requestId }));
      expect(JSON.stringify(log.mock.calls)).not.toContain("ambiguous relationship details");
    } finally {
      log.mockRestore();
    }
  });
});
