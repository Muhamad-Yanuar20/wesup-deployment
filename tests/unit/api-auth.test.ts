import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as signup } from "@/app/api/auth/signup/route";
import { UmkmRegistrationError } from "@/lib/umkm-registration/service";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const { registerUmkmMock } = vi.hoisted(() => ({ registerUmkmMock: vi.fn() }));

vi.mock("@/lib/umkm-registration/service", () => ({
  registerUmkm: registerUmkmMock,
  isDuplicateUmkmEmailError: (error: unknown) => (error as { name?: string })?.name === "DuplicateUmkmEmailError",
  isUmkmEmailRateLimitError: (error: unknown) => (error as { name?: string })?.name === "UmkmEmailRateLimitError",
  UmkmRegistrationError: class UmkmRegistrationError extends Error {
    stage: string;
    correlationId?: string;
    constructor(message: string, stage = "unknown", correlationId?: string) { super(message); this.name = "UmkmRegistrationError"; this.stage = stage; this.correlationId = correlationId; }
  },
}));


function postJson(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function postBadJson(url: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: "{not json",
  });
}

function mockClient(auth: Record<string, ReturnType<typeof vi.fn>>) {
  const client = { auth };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return client;
}

interface SessionClientOptions {
  user?: { id: string; email?: string } | null;
  getUserError?: Error | null;
  profile?: { role: string; status: string; full_name: string } | null;
  profileError?: Error | null;
  supplierVerification?: "pending" | "approved" | "rejected" | null;
  umkmProfile?: boolean;
}

function mockSessionClient(options: SessionClientOptions) {
  const getUser = vi.fn(async () =>
    options.getUserError
      ? { data: { user: null }, error: options.getUserError }
      : { data: { user: options.user ?? null }, error: null },
  );
  const single = vi.fn(async () =>
    options.profileError
      ? { data: null, error: options.profileError }
      : { data: options.profile ?? null, error: null },
  );
  const maybeSingle = vi.fn(async () => ({
    data: options.supplierVerification === undefined
      ? (options.umkmProfile ? { user_id: options.user?.id ?? "u-1" } : null)
      : (options.supplierVerification ? { verification_status: options.supplierVerification } : null),
    error: null,
  }));
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => table === "profiles" ? { single } : { maybeSingle }),
    })),
  }));
  const client = { auth: { getUser }, from };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, getUser, from };
}

describe("POST /api/auth/signup", () => {
  const validSignup = { email: "buyer@example.com", password: "password123", full_name: "Budi Buyer", phone: "081234567890", latitude: -6.914744, longitude: 107.60981 };

  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    registerUmkmMock.mockReset();
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    const auth = { signUp: vi.fn() };
    mockClient(auth);
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
    const res = await signup(postJson("/api/auth/signup", validSignup));
    expect(res.status).toBe(429);
    expect(registerUmkmMock).not.toHaveBeenCalled();
  });

  it("returns only the success contract and never a user payload", async () => {
    registerUmkmMock.mockResolvedValue({ ok: true, requiresEmailConfirmation: false });
    const res = await signup(postJson("/api/auth/signup", { ...validSignup, role: "supplier", userId: "forged" }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true, requiresEmailConfirmation: false });
    expect(registerUmkmMock).toHaveBeenCalledWith({ fullName: "Budi Buyer", phone: "081234567890", email: "buyer@example.com", password: "password123", latitude: -6.914744, longitude: 107.60981 });
  });

  it("returns the email confirmation state", async () => {
    registerUmkmMock.mockResolvedValue({ ok: true, requiresEmailConfirmation: true });
    const res = await signup(postJson("/api/auth/signup", { ...validSignup, email: "sari@example.com", full_name: "Sari" }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true, requiresEmailConfirmation: true });
  });

  it("requires a valid location before calling the service", async () => {
    const res = await signup(postJson("/api/auth/signup", { ...validSignup, latitude: undefined, longitude: undefined }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "validation_error", fieldErrors: { latitude: expect.any(String), longitude: expect.any(String) } });
    expect(registerUmkmMock).not.toHaveBeenCalled();
  });

  it("logs the registration correlation ID for server failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerUmkmMock.mockRejectedValueOnce(new UmkmRegistrationError("database failure", "profile_insert", "corr-umkm-123"));

    const res = await signup(postJson("/api/auth/signup", validSignup));

    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith("[auth/signup] UMKM registration failed", {
      stage: "profile_insert",
      message: "database failure",
      correlationId: "corr-umkm-123",
    });
    errorSpy.mockRestore();
  });
  it("maps duplicate, rate-limit, and unexpected service failures", async () => {
    registerUmkmMock.mockRejectedValueOnce({ name: "DuplicateUmkmEmailError" });
    expect((await signup(postJson("/api/auth/signup", validSignup))).status).toBe(409);
    registerUmkmMock.mockRejectedValueOnce({ name: "UmkmEmailRateLimitError" });
    expect((await signup(postJson("/api/auth/signup", validSignup))).status).toBe(429);
    registerUmkmMock.mockRejectedValueOnce(new Error("unexpected"));
    expect((await signup(postJson("/api/auth/signup", validSignup))).status).toBe(500);
  });
});
describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const auth = { signInWithPassword: vi.fn() };
    mockClient(auth);
    const res = await login(postBadJson("/api/auth/login"));
    expect(res.status).toBe(400);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 with ok true", async () => {
    const auth = { signOut: vi.fn(async () => ({ error: null })) };
    mockClient(auth);
    const res = await logout();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("still returns 200 when signOut fails", async () => {
    const auth = { signOut: vi.fn(async () => ({ error: new Error("boom") })) };
    mockClient(auth);
    const res = await logout();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGetServerClient.mockReset();
  });

  it("returns 200 and redirects to the reset page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const auth = {
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    };
    mockClient(auth);
    const res = await forgotPassword(postJson("/api/auth/forgot-password", {
      email: "buyer@example.com",
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("buyer@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
  });

  it("uses NEXT_PUBLIC_SITE_URL for the redirect when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://wesup.example");
    const auth = {
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    };
    mockClient(auth);
    await forgotPassword(postJson("/api/auth/forgot-password", {
      email: "buyer@example.com",
    }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("buyer@example.com", {
      redirectTo: "https://wesup.example/reset-password",
    });
  });

  it("returns 200 even when supabase reports an error (no user enumeration)", async () => {
    const auth = {
      resetPasswordForEmail: vi.fn(async () => ({ error: new Error("User not found") })),
    };
    mockClient(auth);
    const res = await forgotPassword(postJson("/api/auth/forgot-password", {
      email: "nobody@example.com",
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("returns 400 for an invalid email", async () => {
    const auth = { resetPasswordForEmail: vi.fn() };
    mockClient(auth);
    const res = await forgotPassword(postJson("/api/auth/forgot-password", {
      email: "not-an-email",
    }));
    expect(res.status).toBe(400);
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const auth = { resetPasswordForEmail: vi.fn() };
    mockClient(auth);
    const res = await forgotPassword(postBadJson("/api/auth/forgot-password"));
    expect(res.status).toBe(400);
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("exchanges the code and updates the password", async () => {
    const auth = {
      exchangeCodeForSession: vi.fn(async () => ({
        data: { session: { user: { id: "u-1" } } },
        error: null,
      })),
      updateUser: vi.fn(async () => ({
        data: { user: { id: "u-1" } },
        error: null,
      })),
    };
    mockClient(auth);
    const res = await resetPassword(postJson("/api/auth/reset-password", {
      code: "reset-code-123",
      password: "new-password-456",
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("reset-code-123");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password-456" });
  });

  it("returns 400 for an invalid or expired code", async () => {
    const auth = {
      exchangeCodeForSession: vi.fn(async () => ({
        data: { session: null },
        error: { message: "Invalid code" },
      })),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    };
    mockClient(auth);
    const res = await resetPassword(postJson("/api/auth/reset-password", {
      code: "bad-code",
      password: "new-password-456",
    }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid or expired reset code" });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("returns 400 and signs out when the password update fails", async () => {
    const auth = {
      exchangeCodeForSession: vi.fn(async () => ({
        data: { session: { user: { id: "u-1" } } },
        error: null,
      })),
      updateUser: vi.fn(async () => ({
        data: { user: null },
        error: { message: "Password update failed" },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    };
    mockClient(auth);
    const res = await resetPassword(postJson("/api/auth/reset-password", {
      code: "reset-code-123",
      password: "new-password-456",
    }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid or expired reset code" });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("returns 400 when the code is missing", async () => {
    const auth = { exchangeCodeForSession: vi.fn(), updateUser: vi.fn() };
    mockClient(auth);
    const res = await resetPassword(postJson("/api/auth/reset-password", {
      password: "new-password-456",
    }));
    expect(res.status).toBe(400);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("returns 400 for a password shorter than 8 characters", async () => {
    const auth = { exchangeCodeForSession: vi.fn(), updateUser: vi.fn() };
    mockClient(auth);
    const res = await resetPassword(postJson("/api/auth/reset-password", {
      code: "reset-code-123",
      password: "short",
    }));
    expect(res.status).toBe(400);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const auth = { exchangeCodeForSession: vi.fn(), updateUser: vi.fn() };
    mockClient(auth);
    const res = await resetPassword(postBadJson("/api/auth/reset-password"));
    expect(res.status).toBe(400);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns the user and access state for an active session", async () => {
    mockSessionClient({
      user: { id: "u-1", email: "buyer@example.com" },
      profile: { role: "supplier", status: "active", full_name: "Budi Supplier" },
      supplierVerification: "approved",
    });
    const res = await getSession();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { email: "buyer@example.com" },
      profile: { role: "supplier", status: "active", full_name: "Budi Supplier" },
      accessState: { role: "supplier", status: "active", verificationStatus: "approved" },
      homePath: "/supplier",
    });
  });

  it("returns 401 when there is no session", async () => {
    mockSessionClient({ user: null });
    const res = await getSession();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Sign in required" });
  });

  it("returns 401 when getUser fails", async () => {
    mockSessionClient({ getUserError: new Error("boom") });
    const res = await getSession();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Sign in required" });
  });

  it("returns 401 when the profile lookup fails", async () => {
    mockSessionClient({ user: { id: "u-1" }, profileError: new Error("boom") });
    const res = await getSession();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Sign in required" });
  });

  it("returns 403 with the status as reason when suspended", async () => {
    mockSessionClient({
      user: { id: "u-1", email: "suspended@example.com" },
      profile: { role: "supplier", status: "suspended_temporary", full_name: "Suspended" },
    });
    const res = await getSession();
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "Account is suspended_temporary",
      reason: "suspended_temporary",
    });
  });

  it("returns 403 with the status as reason when banned", async () => {
    mockSessionClient({
      user: { id: "u-1", email: "banned@example.com" },
      profile: { role: "supplier", status: "banned", full_name: "Banned" },
    });
    const res = await getSession();
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "Account is banned",
      reason: "banned",
    });
  });
});
