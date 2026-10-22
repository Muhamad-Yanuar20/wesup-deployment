import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { chargeQris, expireTransaction, MidtransProviderError } from "@/lib/payments/midtrans";

describe("Midtrans QRIS adapter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends custom expiry in seconds and preserves QR action", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ order_id: "WESUP-1", transaction_id: "tx-1", transaction_status: "pending", actions: [{ name: "generate-qr-code-v2", url: "https://qr.example/1" }] }), { status: 200 }));
    const result = await chargeQris({ orderId: "WESUP-1", grossAmount: 12000, idempotencyKey: "idem-1", expiresAt: new Date(Date.now() + 60_000).toISOString() }, { MIDTRANS_SERVER_KEY: "sandbox-key", MIDTRANS_IS_PRODUCTION: "false" } as unknown as NodeJS.ProcessEnv);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ custom_expiry: { unit: "second" } });
    expect(result.qrCodeUrl).toBe("https://qr.example/1");
  });

  it("rejects malformed production flag and exposes expire endpoint", async () => {
    await expect(chargeQris({ orderId: "WESUP-1", grossAmount: 1, idempotencyKey: "idem" }, { MIDTRANS_SERVER_KEY: "key", MIDTRANS_IS_PRODUCTION: "faalse" } as unknown as NodeJS.ProcessEnv)).rejects.toBeInstanceOf(MidtransProviderError);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ order_id: "WESUP-1", transaction_status: "expire" }), { status: 200 }));
    await expireTransaction("WESUP-1", { MIDTRANS_SERVER_KEY: "key", MIDTRANS_IS_PRODUCTION: "false" } as unknown as NodeJS.ProcessEnv);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/v2/WESUP-1/expire");
  });

  it("keeps the provider rejection reason so the UMKM can be told what failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status_code: "400",
      status_message: "Transaction amount is not equal to the expected total.",
      error_messages: ["Transaction amount is not equal to the expected total.", "Invalid gross amount."],
      request_id: "req-abc-123",
    }), { status: 400 }));

    const error = await chargeQris({ orderId: "WESUP-1", grossAmount: 12000, idempotencyKey: "idem" }, { MIDTRANS_SERVER_KEY: "key", MIDTRANS_IS_PRODUCTION: "false" } as unknown as NodeJS.ProcessEnv).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(MidtransProviderError);
    const providerError = error as MidtransProviderError;
    expect(providerError.providerMessage).toBe("Transaction amount is not equal to the expected total.");
    expect(providerError.errorMessages).toEqual(["Transaction amount is not equal to the expected total.", "Invalid gross amount."]);
    expect(providerError.requestId).toBe("req-abc-123");
    expect(providerError.retryable).toBe(false);
  });
});
