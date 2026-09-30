import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readAllSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function policiesOn(allSql: string, table: string): Array<{ name: string; action: string }> {
  const dropped = new Set<string>();
  const dropRe = /drop\s+policy\s+if\s+exists\s+"?([a-zA-Z0-9_]+)"?\s+on\s+public\.([a-zA-Z0-9_]+)/gi;
  for (const m of allSql.matchAll(dropRe)) {
    dropped.add(`${m[1]}:${m[2]}`);
  }
  const result: Array<{ name: string; action: string }> = [];
  const re = new RegExp(
    `create\\s+policy\\s+"?([a-zA-Z0-9_]+)"?\\s+on\\s+public\\.${table}\\s+for\\s+(all|select|insert|update|delete)`,
    "gi",
  );
  for (const m of allSql.matchAll(re)) {
    if (dropped.has(`${m[1]}:${table}`)) continue;
    result.push({ name: m[1], action: m[2].toUpperCase() });
  }
  return result;
}

describe("bank account RLS migration", () => {
  let sql: string;

  beforeAll(() => {
    sql = readAllSql();
  });

  it("is present as a migration", () => {
    expect(
      readdirSync(MIGRATIONS_DIR).some((file) =>
        file.includes("bank_account_rls"),
      ),
    ).toBe(true);
  });

  it("drops the broad UMKM FOR ALL policy on umkm_bank_accounts", () => {
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+"umkm_bank_accounts_own_all"\s+on\s+public\.umkm_bank_accounts/i,
    );
  });

  it("gives umkm_bank_accounts owner-only SELECT with no write policies", () => {
    const policies = policiesOn(sql, "umkm_bank_accounts");
    expect(policies).toContainEqual({
      name: "umkm_bank_accounts_owner_select",
      action: "SELECT",
    });
    expect(policies.some((p) => p.action !== "SELECT")).toBe(false);
  });

  it("keeps supplier bank account SELECT owner-or-admin but gates on approval", () => {
    expect(sql).toMatch(
      /create\s+policy\s+"supplier_bank_accounts_supplier_select"\s+on\s+public\.supplier_bank_accounts[\s\S]*?for\s+select[\s\S]*?is_approved_supplier/i,
    );
    const policies = policiesOn(sql, "supplier_bank_accounts");
    for (const p of policies) {
      expect(p.action).toBe("SELECT");
    }
  });
});