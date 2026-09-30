import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, shouldAllowMidtransCsp } from "@/lib/security/csp";

describe("payment page Content Security Policy", () => {
  it("whitelists the Midtrans Snap dependencies only when enabled", () => {
    const { policy } = buildContentSecurityPolicy("test-nonce", { allowMidtrans: true });

    expect(policy).toContain("frame-src https://*.midtrans.com https://*.veritrans.co.id");
    expect(policy).toContain("https://*.cloudfront.net");
    expect(policy).toContain("https://*.mixpanel.com");
    expect(policy).toContain("https://*.google-analytics.com");
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
  });

  it("does not grant Midtrans frame access to unrelated pages", () => {
    const { policy } = buildContentSecurityPolicy("test-nonce");

    expect(policy).not.toContain("frame-src https://*.midtrans.com");
    expect(policy).not.toContain("https://*.midtrans.com");
  });
  it("enables the allowlist only for the payment route", () => {
    expect(shouldAllowMidtransCsp("/pesanan/registration-id/bayar")).toBe(true);
    expect(shouldAllowMidtransCsp("/pesanan/registration-id/bayar/")).toBe(true);
    expect(shouldAllowMidtransCsp("/pesanan/registration-id/serah-terima")).toBe(false);
    expect(shouldAllowMidtransCsp("/supplier/batches/registration-id/transaksi")).toBe(false);
  });
});
