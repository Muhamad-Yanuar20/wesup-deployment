import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909060000_profile_rls_recovery.sql",
);

describe("profile RLS recovery migration", () => {
  it("exists as an idempotent repair for profile privacy drift", () => {
    expect(existsSync(MIGRATION)).toBe(true);
    const sql = readFileSync(MIGRATION, "utf8");

    for (const table of ["profiles", "supplier_profiles"]) {
      expect(sql).toMatch(
        new RegExp(
          `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(`revoke\\s+select\\s+on\\s+public\\.${table}\\s+from\\s+anon`, "i"),
      );
    }

    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"?profiles_select_own"?/i);
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"?supplier_profiles_select_own"?/i);
    expect(sql).toMatch(/create\s+policy\s+"?profiles_rls_recovery_select_own"?/i);
    expect(sql).toMatch(/create\s+policy\s+"?supplier_profiles_rls_recovery_select_own"?/i);
  });
});
