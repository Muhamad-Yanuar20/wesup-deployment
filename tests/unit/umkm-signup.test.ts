import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as signup } from "@/app/api/auth/signup/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("UMKM signup contract", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  it("always creates the default UMKM signup without forwarding a browser role", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: { id: "u-1", email: "buyer@example.com" }, session: { id: "session-1" } },
      error: null,
    }));
    mockGetServerClient.mockResolvedValue({ auth: { signUp } } as unknown as SupabaseClient<Database>);

    const response = await signup(request({
      full_name: "  Budi Buyer  ",
      phone: "081234567890",
      email: " BUYER@example.com ",
      password: "password123",
      role: "supplier",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: "u-1" },
      requiresEmailConfirmation: false,
    });
    expect(signUp).toHaveBeenCalledWith({
      email: "buyer@example.com",
      password: "password123",
      phone: "081234567890",
      options: { data: { full_name: "Budi Buyer" } },
    });
    expect((signUp.mock.calls[0] as unknown[])[0]).not.toHaveProperty("options.data.role");
  });

  it("returns a confirmation state when Supabase does not create a session", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: { id: "u-2", email: "pending@example.com" }, session: null },
      error: null,
    }));
    mockGetServerClient.mockResolvedValue({ auth: { signUp } } as unknown as SupabaseClient<Database>);

    const response = await signup(request({
      full_name: "Sari",
      phone: "081234567890",
      email: "pending@example.com",
      password: "password123",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ requiresEmailConfirmation: true });
  });

  it("uses a role-safe duplicate email response", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "user_already_exists", message: "User already registered" },
    }));
    mockGetServerClient.mockResolvedValue({ auth: { signUp } } as unknown as SupabaseClient<Database>);

    const response = await signup(request({
      full_name: "Budi",
      phone: "081234567890",
      email: "supplier@example.com",
      password: "password123",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "email_registered_other_role",
      error: expect.stringMatching(/role lain/i),
    });
  });
});
