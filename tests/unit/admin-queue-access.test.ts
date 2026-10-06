import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as suppliers } from "@/app/api/admin/suppliers/route";
import { GET as catalog } from "@/app/api/admin/catalog/route";
import { GET as disputes } from "@/app/api/admin/disputes/route";
import { requireRole, AuthError } from "@/lib/supabase/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/auth", async (original) => ({ ...await original<typeof import("@/lib/supabase/auth")>(), requireRole: vi.fn() }));
describe("merged admin queue access", () => {
  beforeEach(() => vi.clearAllMocks());
  for (const [name, handler] of [["suppliers", suppliers], ["catalog", catalog], ["disputes", disputes]] as const) {
    it(`${name} does not query service-role data without an admin session`, async () => {
      vi.mocked(requireRole).mockRejectedValue(new AuthError(403, "forbidden"));
      const response = await handler(new Request(`http://localhost/api/admin/${name}`));
      expect(response.status).toBe(403);
      expect(getAdminClient).not.toHaveBeenCalled();
    });
    it(`${name} respects rate limiting before service-role reads`, async () => {
      vi.mocked(requireRole).mockResolvedValue({ userId: "admin", email: "admin@example.com", role: "admin", status: "active", fullName: "Admin" });
      vi.mocked(enforceRateLimit).mockResolvedValue(new NextResponse(null, { status: 429 }));
      const response = await handler(new Request(`http://localhost/api/admin/${name}`));
      expect(response.status).toBe(429);
      expect(getAdminClient).not.toHaveBeenCalled();
    });
  }
});
