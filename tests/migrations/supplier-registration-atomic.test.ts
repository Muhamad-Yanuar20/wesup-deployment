import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909080000_supplier_registration_atomic.sql",
);

describe("supplier registration atomic commit migration", () => {
  it("creates a service-role-only function that commits the Supplier role and pending profile together", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.create_supplier_registration\s*\(/i,
    );
    expect(sql).toMatch(/update\s+public\.profiles[\s\S]*set\s+role\s*=\s*'supplier'/i);
    expect(sql).toMatch(/insert\s+into\s+public\.supplier_profiles/i);
    expect(sql).toMatch(/verification_status\s*[),][\s\S]*'pending'/i);
    expect(sql).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.create_supplier_registration/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.create_supplier_registration[^;]*to\s+service_role/i,
    );
  });
});
