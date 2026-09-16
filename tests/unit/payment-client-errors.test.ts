import { describe, expect, it } from "vitest";
import { parsePaymentApiError } from "@/lib/payments/client-errors";

describe("payment API client errors", () => {
  it("preserves code and request reference while using a friendly admin message", () => {
    expect(parsePaymentApiError({ error: "Konfigurasi admin pembayaran belum tersedia.", code: "PAYMENT_ADMIN_CONFIG_MISSING", requestId: "req-123" }, "Pembayaran gagal.")).toEqual({
      message: "Konfigurasi pembayaran server belum siap. Coba lagi setelah konfigurasi diperbaiki.",
      code: "PAYMENT_ADMIN_CONFIG_MISSING",
      requestId: "req-123",
    });
  });

  it("keeps provider messages and ignores malformed metadata", () => {
    expect(parsePaymentApiError({ error: "Provider pembayaran gagal dihubungi", code: "PAYMENT_PROVIDER_UNAVAILABLE", requestId: 42 }, "Pembayaran gagal.")).toEqual({
      message: "Provider pembayaran sedang tidak tersedia. Coba lagi.",
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
    expect(parsePaymentApiError({}, "Pembayaran gagal.")).toEqual({ message: "Pembayaran gagal." });
  });
});