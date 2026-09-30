import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const path = join(process.cwd(), "supabase", "migrations", "20260916000000_fix_supplier_invoice_upsert.sql");

describe("Supplier invoice UPSERT fix migration", () => {
  it("qualifies the existing payment status in the conflict handler", () => {
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const migration = readFileSync(path, "utf8");
    expect(migration).toMatch(/create or replace function public\.close_batch_and_issue_invoices/i);
    expect(migration).toMatch(/insert\s+into\s+public\.payments\s+as\s+existing/i);
    expect(migration).toMatch(/existing\.status\s*=\s*'paid'/i);
    expect(migration).not.toMatch(/case\s+when\s+status\s*=\s*'paid'/i);
    expect(migration).not.toMatch(/drop\s+(table|function)\s+/i);
  });
});
