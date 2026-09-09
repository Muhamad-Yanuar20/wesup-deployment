import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("canonical UMKM routes", () => {
  it("provides the guarded dashboard and workspace pages", () => {
    for (const route of [
      "app/umkm/layout.tsx",
      "app/umkm/page.tsx",
      "app/umkm/pesanan/page.tsx",
      "app/umkm/notifikasi/page.tsx",
      "app/umkm/akun/page.tsx",
      "app/umkm/onboarding/page.tsx",
    ]) {
      expect(existsSync(join(root, route)), `missing ${route}`).toBe(true);
    }
  });

  it("keeps old UMKM URLs as redirects instead of duplicate workspaces", () => {
    expect(readFileSync(join(root, "app/pesanan/page.tsx"), "utf8")).toContain('redirect("/umkm/pesanan")');
    expect(readFileSync(join(root, "app/notifikasi/page.tsx"), "utf8")).toContain('redirect("/umkm/notifikasi")');
    expect(readFileSync(join(root, "app/akun/page.tsx"), "utf8")).toContain('redirect("/umkm/akun")');
    expect(readFileSync(join(root, "app/beranda-umkm/page.tsx"), "utf8")).toContain('redirect("/umkm")');
  });
});
