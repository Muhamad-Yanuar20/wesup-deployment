import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as signup } from "@/app/api/auth/signup/route";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerUmkm } from "@/lib/umkm-registration/service";

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/umkm-registration/service", () => ({
  registerUmkm: vi.fn(),
  isDuplicateUmkmEmailError: (error: unknown) => (error as { name?: string })?.name === "DuplicateUmkmEmailError",
  isUmkmEmailRateLimitError: (error: unknown) => (error as { name?: string })?.name === "UmkmEmailRateLimitError",
  UmkmRegistrationError: class UmkmRegistrationError extends Error {
    stage: string;
    constructor(message: string, stage = "unknown") { super(message); this.name = "UmkmRegistrationError"; this.stage = stage; }
  },
}));

const mockRegister = vi.mocked(registerUmkm);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/signup", { method: "POST", body: JSON.stringify(body) });
}

describe("UMKM signup contract", () => {
  beforeEach(() => {
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    mockRegister.mockReset();
  });

  it("validates location and never forwards a browser role", async () => {
    const response = await signup(request({
      full_name: "Budi Buyer",
      phone: "081234567890",
      email: "buyer@example.com",
      password: "password123",
      role: "supplier",
    }));
    expect(response.status).toBe(400);
    expect(mockRegister).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: "validation_error", fieldErrors: { latitude: expect.any(String), longitude: expect.any(String) } });
  });

  it("creates a UMKM account with location and returns no user payload", async () => {
    mockRegister.mockResolvedValue({ ok: true, requiresEmailConfirmation: false });
    const response = await signup(request({
      full_name: " Budi Buyer ", phone: "081234567890", email: " BUYER@example.com ", password: "password123",
      latitude: -6.914744, longitude: 107.60981, role: "supplier",
    }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, requiresEmailConfirmation: false });
    expect(mockRegister).toHaveBeenCalledWith({
      fullName: "Budi Buyer", phone: "081234567890", email: "buyer@example.com", password: "password123",
      latitude: -6.914744, longitude: 107.60981,
    });
  });

  it("returns confirmation state", async () => {
    mockRegister.mockResolvedValue({ ok: true, requiresEmailConfirmation: true });
    const response = await signup(request({ full_name: "Sari", phone: "081234567890", email: "sari@example.com", password: "password123", latitude: -6.914744, longitude: 107.60981 }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, requiresEmailConfirmation: true });
  });
});