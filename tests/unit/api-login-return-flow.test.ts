import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as login } from "@/app/api/auth/login/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockClient(options: {
  role: "umkm" | "supplier";
  verificationStatus?: "pending" | "approved" | "rejected";
  returnTo?: string;
}) {
  const signOut = vi.fn(async () => ({ error: null }));
  const supplierMaybeSingle = vi.fn(async () => ({
    data: options.verificationStatus
      ? { verification_status: options.verificationStatus }
      : null,
    error: null,
  }));
  const from = vi.fn((table: string) =>
    table === "profiles"
      ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({
        data: { role: options.role, status: "active", full_name: "Budi" },
        error: null,
      })) })) })) }
      : { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: supplierMaybeSingle })) })) },
  );
  const client = {
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: "u-1", email: "budi@example.com" } },
        error: null,
      })),
      getUser: vi.fn(async () => ({ data: { user: { id: "u-1", email: "budi@example.com" } }, error: null })),
      signOut,
    },
    from,
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  vi.mocked(enforceRateLimit).mockResolvedValue(null);
  return { client, signOut };
}

describe("login return flow", () => {
  it("lets pending Supplier accounts sign in to /supplier/status", async () => {
    const { signOut } = mockClient({ role: "supplier", verificationStatus: "pending" });
    const response = await login(request({
      email: "budi@example.com",
      password: "password123",
      role: "supplier",
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ redirectTo: "/supplier/status" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("uses a same-origin marketplace returnTo for UMKM", async () => {
    mockClient({ role: "umkm" });
    const response = await login(request({
      email: "budi@example.com",
      password: "password123",
      role: "umkm",
      returnTo: "/marketplace/batch-1",
    }));
    await expect(response.json()).resolves.toMatchObject({ redirectTo: "/marketplace/batch-1" });
  });

  it("falls back to the role home for an external returnTo", async () => {
    mockClient({ role: "umkm" });
    const response = await login(request({
      email: "budi@example.com",
      password: "password123",
      role: "umkm",
      returnTo: "https://evil.example/redirect",
    }));
    await expect(response.json()).resolves.toMatchObject({ redirectTo: "/umkm" });
  });
});
