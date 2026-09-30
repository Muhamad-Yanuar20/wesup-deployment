import { describe, expect, it } from "vitest";
import { validatePaymentEnvironment } from "../../scripts/check-payment-readiness.mjs";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_valid",
  SUPABASE_SERVICE_ROLE_KEY: "service_valid",
  MIDTRANS_SERVER_KEY: "server_valid",
  MIDTRANS_CLIENT_KEY: "client_valid",
  MIDTRANS_IS_PRODUCTION: "false",
};

describe("payment readiness environment", () => {
  it("requires an admin key and Midtrans configuration", () => {
    const result = validatePaymentEnvironment({ NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining(["supabase_admin_key", "midtrans_server_key", "midtrans_client_key", "midtrans_production_flag"]));
  });

  it("prefers the new Supabase secret key and allows localhost without a public site URL", () => {
    const result = validatePaymentEnvironment(valid);
    expect(result).toMatchObject({ ok: true, adminKeySource: "secret", publicSiteConfigured: false });
  });

  it("accepts the legacy service-role fallback", () => {
    const legacy = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "SUPABASE_SECRET_KEY"));
    expect(validatePaymentEnvironment(legacy).ok).toBe(true);
  });

  it("requires a valid public site URL for public deployments", () => {
    expect(validatePaymentEnvironment(valid, { publicDeployment: true }).failures).toContain("public_site_url");
    expect(validatePaymentEnvironment({ ...valid, NEXT_PUBLIC_SITE_URL: "https://dev.example.com" }, { publicDeployment: true }).ok).toBe(true);
  });

  it("rejects an invalid production flag and malformed URLs", () => {
    const result = validatePaymentEnvironment({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url", MIDTRANS_IS_PRODUCTION: "FALSE" });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining(["supabase_url", "midtrans_production_flag"]));
  });
});