import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(() => ({ claims: vi.fn(), user: vi.fn(), refreshed: false }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: Array<{name: string; value: string; options: object}>, headers: Record<string,string>) => void } }) => {
  if (mocks.refreshed) options.cookies.setAll([{ name: "sb-test", value: "refreshed", options: { httpOnly: true } }], { "cache-control": "private, no-store" });
  return { auth: { getClaims: mocks.claims, getUser: mocks.user } };
} }));
beforeEach(() => {
 vi.clearAllMocks(); mocks.refreshed = false;
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
 mocks.claims.mockResolvedValue({ data: { claims: { sub: "fixture" } }, error: null });
});
it("verifies claims without a remote getUser round trip and preserves CSP", async () => {
 const response = await proxy(new NextRequest("http://localhost/supplier"));
 expect(mocks.claims).toHaveBeenCalledTimes(1); expect(mocks.user).not.toHaveBeenCalled();
 expect(response.headers.get("server-timing")).toContain("proxy_auth;dur=");
 expect(response.headers.get("content-security-policy")).toContain("nonce-");
 expect(response.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
});
it("forwards refreshed cookies and prevents caching a refreshed session", async () => {
 mocks.refreshed = true;
 const response = await proxy(new NextRequest("http://localhost/supplier"));
 expect(response.cookies.get("sb-test")?.value).toBe("refreshed");
 expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-test=refreshed");
 expect(response.headers.get("cache-control")).toBe("private, no-store");
 expect(response.headers.get("content-security-policy")).toContain("nonce-");
});
it("does not erase cookies on a verification transport failure; server guards still run", async () => {
 mocks.claims.mockRejectedValue(new TypeError("offline"));
 const response = await proxy(new NextRequest("http://localhost/supplier", { headers: { cookie: "sb-test=existing" } }));
 expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-test=existing");
 expect(response.headers.get("set-cookie")).toBeNull();
 expect(response.headers.get("x-middleware-next")).toBe("1");
});
