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

function functionBody(sql: string, name: string): string {
  const re = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$;`,
    "ig",
  );
  const matches = [...sql.matchAll(re)];
  return matches.length ? matches[matches.length - 1][0] : "";
}

function policiesOn(allSql: string, table: string): Array<{ name: string; action: string }> {
  const result: Array<{ name: string; action: string }> = [];
  const re = new RegExp(
    `create\\s+policy\\s+"?([a-zA-Z0-9_]+)"?\\s+on\\s+public\\.${table}\\s+for\\s+(all|select|insert|update|delete)`,
    "gi",
  );
  for (const m of allSql.matchAll(re)) {
    result.push({ name: m[1], action: m[2].toUpperCase() });
  }
  return result;
}

describe("transaction log migration", () => {
  let sql: string;

  beforeAll(() => {
    sql = readAllSql();
  });

  it("is present as a migration", () => {
    expect(
      readdirSync(MIGRATIONS_DIR).some((file) =>
        file.includes("transaction_log"),
      ),
    ).toBe(true);
  });

  it("creates the transaction_logs table with the gateway-facing columns", () => {
    const table = sql.match(/create\s+table\s+if\s+not\s+exists\s+public\.transaction_logs[\s\S]*?\);\s*$/m)?.[0] ?? "";
    for (const column of [
      "registration_id",
      "payment_id",
      "payment_attempt_id",
      "event_type",
      "from_status",
      "to_status",
      "provider_status",
      "gateway_transaction_id",
      "payload",
      "source",
      "actor_id",
      "created_at",
    ]) {
      expect(table, `transaction_logs.${column}`).toMatch(
        new RegExp(`\\b${column}\\s+[a-zA-Z_\\s]+`),
      );
    }
    expect(table).toMatch(/references\s+public\.registrations/);
    expect(table).toMatch(/event_type\s+text[^,]*check\s*\(/);
    expect(table).toMatch(/source\s+text[^,]*check\s*\(/);
  });

  it("enables RLS with role-aware SELECT and admin-only writes", () => {
    expect(sql).toMatch(/alter\s+table\s+public\.transaction_logs\s+enable\s+row\s+level\s+security/i);
    const policies = policiesOn(sql, "transaction_logs");
    expect(policies).toContainEqual({ name: "transaction_logs_umkm_select", action: "SELECT" });
    expect(policies).toContainEqual({ name: "transaction_logs_supplier_select", action: "SELECT" });
    expect(policies).toContainEqual({ name: "transaction_logs_admin_all", action: "ALL" });
  });

  it("records payments.status transitions inside apply_midtrans_payment_event", () => {
    const body = functionBody(sql, "apply_midtrans_payment_event");
    expect(body).toContain("record_transaction_log");
    for (const marker of ["payment_status_change", "gateway_event", "'webhook'", "p_provider_transaction_id"]) {
      expect(body).toContain(marker);
    }
  });

  it("grants the SECURITY DEFINER writer to service_role only", () => {
    const body = functionBody(sql, "record_transaction_log");
    expect(body).toMatch(/security\s+definer/i);
    expect(sql).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.record_transaction_log\b[^;]*\bfrom\s+public,\s*anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.record_transaction_log\b[^;]*\bto\s+service_role/i,
    );
  });
});