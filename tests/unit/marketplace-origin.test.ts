import { describe, expect, it, vi } from "vitest";
import { resolveMarketplaceOrigin, type MarketplaceOriginClient } from "@/lib/marketplace/origin";
import type { AuthContext } from "@/lib/supabase/auth";

const umkm = (id: string): AuthContext => ({ userId: id, email: `${id}@example.com`, role: "umkm", status: "active", fullName: "Buyer" });
const supplier = { userId: "supplier-1", email: "supplier@example.com", role: "supplier" as const, status: "active" as const, fullName: "Supplier" };

function client(profile: { latitude: number | string | null; longitude: number | string | null } | null): MarketplaceOriginClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: profile, error: null })) })),
      })),
    })),
  };
}

describe("resolveMarketplaceOrigin", () => {
  it("uses the logged-in UMKM profile even when request coordinates are supplied", async () => {
    const origin = await resolveMarketplaceOrigin(client({ latitude: -6.95, longitude: 107.7 }), umkm("umkm-1"), { latitude: -6.8, longitude: 107.5 });
    expect(origin).toEqual({ latitude: -6.95, longitude: 107.7, source: "umkm_profile", needsProfileLocation: false });
  });

  it("falls back to Bandung and prompts legacy UMKM to save a location", async () => {
    const origin = await resolveMarketplaceOrigin(client(null), umkm("legacy-umkm"));
    expect(origin).toMatchObject({ source: "bandung_default", needsProfileLocation: true });
  });

  it("keeps explicit coordinates available for guest-compatible API callers", async () => {
    const origin = await resolveMarketplaceOrigin(client(null), null, { latitude: -6.9, longitude: 107.6 });
    expect(origin).toEqual({ latitude: -6.9, longitude: 107.6, source: "request", needsProfileLocation: false });
    await expect(resolveMarketplaceOrigin(client(null), supplier)).resolves.toMatchObject({ source: "bandung_default", needsProfileLocation: false });
  });
});