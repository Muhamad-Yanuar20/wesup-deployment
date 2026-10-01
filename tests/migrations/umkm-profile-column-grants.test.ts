import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");
const HARDENING_MIGRATION = "20260920050000_umkm_profile_column_grants.sql";

const migration = readFileSync(resolve(MIGRATIONS_DIR, HARDENING_MIGRATION), "utf8");
const recoveryMigration = readFileSync(
  resolve(MIGRATIONS_DIR, "20260910012225_umkm_registration_profile_recovery.sql"),
  "utf8",
);

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/** Columns the platform owns and an authenticated UMKM must never be able to write. */
const SERVER_OWNED_COLUMNS = [
  "strike_count",
  "suspended_until",
  "user_id",
  "created_at",
];

/** Columns the UMKM profile editor legitimately writes. */
const CLIENT_OWNED_COLUMNS = [
  "business_name",
  "address",
  "latitude",
  "longitude",
  "updated_at",
];

const COLUMN_SCOPED_GRANT = /grant\s+update\s*\(([^)]*)\)\s+on\s+(?:table\s+)?public\.umkm_profiles\s+to\s+authenticated/gi;
const BLANKET_GRANT =
  /grant\s+select,\s*insert,\s*update\s+on\s+(?:table\s+)?public\.umkm_profiles\s+to\s+authenticated/gi;

function grantedColumns(sql: string): string[] {
  return [...sql.matchAll(COLUMN_SCOPED_GRANT)].flatMap((match) =>
    match[1]
      .split(",")
      .map((column) => column.trim().toLowerCase())
      .filter(Boolean),
  );
}

describe("UMKM profile column-grant hardening migration", () => {
  it("revokes the blanket table-level UPDATE grant", () => {
    expect(migration).toMatch(
      /revoke\s+update\s+on\s+(?:table\s+)?public\.umkm_profiles\s+from\s+authenticated/i,
    );
  });

  it("grants UPDATE on exactly the business-profile columns", () => {
    const columns = grantedColumns(migration);
    expect(columns).not.toHaveLength(0);
    expect([...columns].sort()).toEqual([...CLIENT_OWNED_COLUMNS].sort());
  });

  it("never grants a server-owned penalty column", () => {
    const columns = grantedColumns(migration);
    for (const column of SERVER_OWNED_COLUMNS) {
      expect(columns).not.toContain(column);
    }
  });

  it("documents the escalation bypass it closes", () => {
    expect(migration).toContain("apply_hit_and_run_escalation");
    expect(migration).toContain("umkm_profiles_recovery_select_own");
    expect(migration).toContain("ON CONFLICT (user_id) DO UPDATE");
  });

  it("hardens a table whose only protection is a row-scoped policy", () => {
    // The bypass only exists because the owner policy filters rows, not
    // columns. If that policy ever disappears the escalation ladder is
    // exposed beyond any column grant.
    expect(recoveryMigration).toContain('create policy "umkm_profiles_recovery_update_own"');
    expect(recoveryMigration).toContain("for update to authenticated");
    expect(recoveryMigration).toContain("(select auth.uid()) = user_id");
  });

  it("keeps INSERT so the profile upsert can still create a missing row", () => {
    expect(migration).toContain("INSERT is intentionally left in place");
    expect(migration).not.toMatch(/revoke\s+insert\s+on\s+public\.umkm_profiles/i);
  });
});

describe("no migration re-widens the UMKM profile UPDATE grant after hardening", () => {
  const hardeningIndex = migrationFiles.indexOf(HARDENING_MIGRATION);

  it("applies the hardening migration (sort order sanity check)", () => {
    expect(hardeningIndex).toBeGreaterThan(-1);
    expect(hardeningIndex).toBe(migrationFiles.length - 1);
  });

  it("contains no blanket update grant for umkm_profiles", () => {
    const offenders: string[] = [];
    for (const name of migrationFiles) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
      if (BLANKET_GRANT.test(sql)) offenders.push(name);
      BLANKET_GRANT.lastIndex = 0;
    }
    // The two historical migrations are expected to still contain the old text;
    // what matters is that nothing re-introduces it after the hardening file.
    expect(offenders.filter((name) => name > HARDENING_MIGRATION)).toEqual([]);
  });

  it("leaves the effective grant column-scoped", () => {
    const effective: string[] = [];
    for (const name of migrationFiles) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
      if (BLANKET_GRANT.test(sql)) effective.length = 0;
      BLANKET_GRANT.lastIndex = 0;
      const scoped = grantedColumns(sql);
      if (scoped.length > 0) effective.splice(0, effective.length, ...scoped);
    }
    expect(effective.sort()).toEqual([...CLIENT_OWNED_COLUMNS].sort());
  });
});
