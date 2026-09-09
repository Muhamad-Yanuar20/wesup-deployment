import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupplierRegistrationFields } from "@/lib/supplier-registration/contracts";

const mocks = vi.hoisted(() => {
  class MockSupplierRegistrationError extends Error {
    constructor(
      message = "Supplier registration failed",
      public readonly stage = "unknown",
    ) {
      super(message);
      this.name = "SupplierRegistrationError";
    }
  }
  class MockDuplicateSupplierEmailError extends Error {}
  class MockSupplierEmailRateLimitError extends Error {}
  return {
    parseSupplierRegistrationFormData: vi.fn(),
    consumeSupplierRegistrationLimit: vi.fn(),
    registerSupplier: vi.fn(),
    isSupplierConfigurationError: vi.fn(
      (error: unknown) =>
        error instanceof MockSupplierRegistrationError && error.stage === "configuration",
    ),
    isDuplicateSupplierEmailError: vi.fn(
      (error: unknown) => error instanceof MockDuplicateSupplierEmailError,
    ),
    isSupplierEmailRateLimitError: vi.fn(
      (error: unknown) => error instanceof MockSupplierEmailRateLimitError,
    ),
    SupplierRegistrationError: MockSupplierRegistrationError,
    DuplicateSupplierEmailError: MockDuplicateSupplierEmailError,
    SupplierEmailRateLimitError: MockSupplierEmailRateLimitError,
  };
});

vi.mock("@/lib/supplier-registration/contracts", () => ({
  parseSupplierRegistrationFormData: mocks.parseSupplierRegistrationFormData,
}));
vi.mock("@/lib/supplier-registration/rate-limit", () => ({
  consumeSupplierRegistrationLimit: mocks.consumeSupplierRegistrationLimit,
}));
vi.mock("@/lib/supplier-registration/service", () => mocks);

import { POST as register } from "@/app/api/suppliers/register/route";
import { SupplierRegistrationError } from "@/lib/supplier-registration/service";

const fields: SupplierRegistrationFields = {
  fullName: "Budi Supplier",
  email: "budi@example.com",
  phone: "081234567890",
  password: "password-123",
  businessName: "Toko Budi",
  address: "Jl. Bandung No. 1",
  latitude: -6.914744,
  longitude: 107.60981,
  businessPhoto: new File([new Uint8Array([1, 2, 3])], "business.webp", {
    type: "image/webp",
  }),
};

function request(): NextRequest {
  return new NextRequest("http://localhost/api/suppliers/register", {
    method: "POST",
    body: new FormData(),
  });
}

describe("POST /api/suppliers/register", () => {
  beforeEach(() => {
    mocks.parseSupplierRegistrationFormData.mockReset();
    mocks.consumeSupplierRegistrationLimit.mockReset();
    mocks.registerSupplier.mockReset();
    mocks.isSupplierConfigurationError.mockClear();
    mocks.isDuplicateSupplierEmailError.mockClear();
    mocks.isSupplierEmailRateLimitError.mockClear();
    mocks.consumeSupplierRegistrationLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 60,
    });
    mocks.parseSupplierRegistrationFormData.mockResolvedValue({ fields, errors: {} });
    mocks.registerSupplier.mockResolvedValue({
      ok: true,
      verificationStatus: "pending",
      requiresEmailConfirmation: true,
    });
  });

  it("returns 201 for a successful registration", async () => {
    const response = await register(request());
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      verificationStatus: "pending",
      requiresEmailConfirmation: true,
    });
  });

  it("returns 503 with a safe code when Supabase admin configuration is missing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.registerSupplier.mockRejectedValueOnce(
        new SupplierRegistrationError(
          "Supplier admin configuration is missing",
          "configuration",
        ),
      );
      const response = await register(request());
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Pendaftaran sedang mengalami kendala konfigurasi. Coba lagi nanti.",
        code: "SUPPLIER_REGISTRATION_NOT_CONFIGURED",
      });
      expect(log).toHaveBeenCalledWith(
        "[suppliers/register] registration failed",
        expect.objectContaining({ stage: "configuration" }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it("returns 500 with a safe code for an internal registration failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.registerSupplier.mockRejectedValueOnce(
        new SupplierRegistrationError("Supplier profile insert failed", "profile_insert"),
      );
      const response = await register(request());
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Pendaftaran belum dapat diproses. Coba lagi.",
        code: "SUPPLIER_REGISTRATION_FAILED",
      });
      expect(log).toHaveBeenCalledWith(
        "[suppliers/register] registration failed",
        expect.objectContaining({ stage: "profile_insert" }),
      );
    } finally {
      log.mockRestore();
    }
  });
});
