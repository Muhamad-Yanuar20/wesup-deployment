import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readAllSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

describe("supplier role/capability migration", () => {
  let sql: string;

  beforeAll(() => {
    sql = readAllSql();
  });

  it("adds an approved-supplier predicate with all three capability gates", () => {
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.is_approved_supplier\b/i,
    );
    const body = sql.match(
      /create\s+(?:or\s+replace\s+)?function\s+public\.is_approved_supplier\b[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    expect(body).toMatch(/p\.role\s*=\s*'supplier'/i);
    expect(body).toMatch(/p\.status\s*=\s*'active'/i);
    expect(body).toMatch(/sp\.verification_status\s*=\s*'approved'/i);
  });

  it("backfills supplier role without promoting on later approval", () => {
    expect(sql).toMatch(
      /update\s+public\.profiles[\s\S]*set\s+role\s*=\s*'supplier'[\s\S]*from\s+public\.supplier_profiles/i,
    );
    expect(sql).toMatch(
      /drop\s+trigger\s+if\s+exists\s+promote_supplier_on_approval\s+on\s+public\.supplier_profiles/i,
    );
    expect(sql).toMatch(
      /drop\s+function\s+if\s+exists\s+public\.promote_supplier_on_approval/i,
    );
  });

  it("gates every supplier operational table with the approved predicate", () => {
    const tables = [
      "recurring_configs",
      "batches",
      "batch_tiers",
      "batch_timeline",
      "supplier_bank_accounts",
      "registrations",
      "pickup_codes",
      "pickup_events",
      "disputes",
      "escrow_holds",
      "refund_requests",
      "payments",
    ];
    for (const table of tables) {
      expect(
        sql,
        `${table} should be gated by is_approved_supplier`,
      ).toMatch(
        new RegExp(
          `create\\s+policy[^;]*on\\s+public\\.${table}\\b[^;]*is_approved_supplier\\s*\\(\\s*\\)`,
          "i",
        ),
      );
    }
  });

  it("is present as a migration", () => {
    expect(
      readdirSync(MIGRATIONS_DIR).some((file) =>
        file.includes("supplier_role_capability"),
      ),
    ).toBe(true);
    expect(existsSync(MIGRATIONS_DIR)).toBe(true);
  });
});
