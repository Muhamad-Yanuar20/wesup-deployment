import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260909090000_umkm_profile_rls.sql"),
  "utf8",
);

describe("UMKM profile RLS migration", () => {
  it("enables RLS and revokes anonymous access", () => {
    expect(migration).toMatch(/alter table public\.umkm_profiles enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.umkm_profiles from anon/i);
  });

  it("allows only an active UMKM to read, insert, and update its own row", () => {
    expect(migration).toMatch(/for select to authenticated/i);
    expect(migration).toMatch(/for insert to authenticated/i);
    expect(migration).toMatch(/for update to authenticated/i);
    expect(migration).toMatch(/role\s*=\s*'umkm'/i);
    expect(migration).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
  });

  it("keeps admin access explicit", () => {
    expect(migration).toMatch(/umkm_profiles_task10_admin_select/i);
    expect(migration).toMatch(/public\.is_admin\(\)/i);
  });
});
