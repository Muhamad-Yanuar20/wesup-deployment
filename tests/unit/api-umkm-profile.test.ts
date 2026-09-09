import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET, PUT } from "@/app/api/umkm/profile/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);

function makeClient(options: {
  user?: { id: string; email: string } | null;
  role?: "umkm" | "supplier" | "admin";
  profile?: Record<string, unknown> | null;
}) {
  const upsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: {
          user_id: options.user?.id ?? "umkm-1",
          business_name: "Warung Rina",
          address: "Jl. Braga",
          latitude: -6.914744,
          longitude: 107.60981,
        },
        error: null,
      })),
    })),
  }));
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === undefined ? { id: "umkm-1", email: "rina@example.com" } : options.user },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => options.user === null
                ? { data: null, error: new Error("missing user") }
                : { data: { role: options.role ?? "umkm", status: "active", full_name: "Rina" }, error: null }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: options.profile ?? null, error: null })),
          })),
        })),
        upsert,
      };
    }),
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, upsert };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/umkm/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("UMKM profile API", () => {
  beforeEach(() => mockGetServerClient.mockReset());

  it("returns an empty profile for a browsing UMKM without forcing onboarding", async () => {
    makeClient({ profile: null });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ profile: null });
  });

  it("upserts only the authenticated UMKM user row", async () => {
    const { upsert } = makeClient({ profile: null });
    const response = await PUT(jsonRequest({
      businessName: " Warung Rina ",
      address: " Jl. Braga ",
      latitude: -6.914744,
      longitude: 107.60981,
    }));
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({
      user_id: "umkm-1",
      business_name: "Warung Rina",
      address: "Jl. Braga",
      latitude: -6.914744,
      longitude: 107.60981,
    }, { onConflict: "user_id" });
  });

  it("rejects non-UMKM callers before touching the table", async () => {
    const { upsert } = makeClient({ role: "supplier", profile: null });
    const response = await PUT(jsonRequest({
      businessName: "Supplier",
      address: "Bandung",
      latitude: -6.914744,
      longitude: 107.60981,
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "role_forbidden" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a pin outside the Bandung service radius", async () => {
    makeClient({ profile: null });
    const response = await PUT(jsonRequest({
      businessName: "Warung Rina",
      address: "Bandung",
      latitude: -6.2,
      longitude: 107.6,
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "validation_error" });
  });

  it("requires a session", async () => {
    makeClient({ user: null });
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
