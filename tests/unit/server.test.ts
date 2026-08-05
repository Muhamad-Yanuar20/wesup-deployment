import { describe, expect, it, vi, beforeEach } from "vitest";

const URL = "https://woxgghuoeljagnkldqtf.supabase.co";
const KEY = "sb_publishable_test";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

async function loadGetServerClient() {
  vi.resetModules();
  const mod = await import("@/lib/supabase/server");
  return mod.getServerClient;
}

describe("supabase server client factory", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("throws when only the URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("throws when only the publishable key is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("creates a cookie-based client when both env vars are present", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const getServerClient = await loadGetServerClient();
    const client = await getServerClient();
    expect(client.auth).toBeDefined();
    expect(client.from).toBeDefined();
  });
});
