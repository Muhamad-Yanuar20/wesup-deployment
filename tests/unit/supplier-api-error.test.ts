import { describe, expect, it } from "vitest";
import { SupplierApiError, parseSupplierApiError } from "../../lib/supplier-catalog/api-error";

describe("supplier API error", () => {
  it("preserves HTTP status, code, and request reference", async () => {
    const response = new Response(JSON.stringify({
      error: "Konfigurasi lifecycle transaksi belum valid.",
      code: "SUPPLIER_LIFECYCLE_RPC_INVALID",
      requestId: "req-123",
    }), { status: 500, headers: { "content-type": "application/json" } });
    const error = await parseSupplierApiError(response, "Transaksi batch belum dapat dimuat.");
    expect(error).toBeInstanceOf(SupplierApiError);
    expect(error).toMatchObject({ status: 500, code: "SUPPLIER_LIFECYCLE_RPC_INVALID", requestId: "req-123" });
    expect(error.message).toBe("Konfigurasi lifecycle transaksi belum valid.");
  });
});
