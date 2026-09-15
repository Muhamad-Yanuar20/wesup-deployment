import { describe, expect, it } from "vitest";
import { midtransSignature, verifyMidtransSignature } from "@/lib/payments/midtrans-signature";

describe("Midtrans webhook signature", () => {
  it("matches the SHA512 order/status/amount/server-key contract", () => {
    const signature = midtransSignature("ORDER-1", "200", "10000.00", "sandbox-key");
    expect(signature).toHaveLength(128);
    expect(verifyMidtransSignature("ORDER-1", "200", "10000.00", signature, "sandbox-key")).toBe(true);
  });

  it("rejects a changed amount or signature without throwing", () => {
    const signature = midtransSignature("ORDER-1", "200", "10000.00", "sandbox-key");
    expect(verifyMidtransSignature("ORDER-1", "200", "10001.00", signature, "sandbox-key")).toBe(false);
    expect(verifyMidtransSignature("ORDER-1", "200", "10000.00", `${signature}0`, "sandbox-key")).toBe(false);
  });
});
