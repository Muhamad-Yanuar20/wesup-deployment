import { describe, expect, it, vi, beforeEach } from "vitest";

const URL = "https://woxgghuoeljagnkldqtf.supabase.co";
const KEY = "sb_publishable_test";

async function loadClient() {
  vi.resetModules();
  const mod = await import("@/lib/supabase/client");
  return mod.supabase;
}

describe("supabase client factory", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(import("@/lib/supabase/client")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("throws when only the URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(import("@/lib/supabase/client")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("throws when only the publishable key is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    await expect(import("@/lib/supabase/client")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("creates a client when both env vars are present", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const supabase = await loadClient();
    expect(supabase).toBeDefined();
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });
});
