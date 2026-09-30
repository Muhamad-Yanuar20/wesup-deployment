import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260920030000_consolidate_supplier_finance_scans.sql",
  ),
  "utf8",
);

describe("get_supplier_finance scan consolidation", () => {
  it("reads the supplier ledger once instead of four times", () => {
    const scans = migration.match(/from public\.supplier_ledger_entries/gi) ?? [];
    expect(scans.length).toBe(1);
  });

  it("still returns the same four balance keys", () => {
    for (const key of ["escrow", "frozen", "available", "paidOut"]) {
      expect(migration).toMatch(new RegExp(`'${key}',`, "i"));
    }
  });

  it("keeps the coalesce on every total so an empty ledger still reads zero", () => {
    // sum() over zero rows is NULL, and available is a subtraction of two
    // sums, so a missing coalesce would surface null instead of 0.
    expect(migration).toMatch(
      /coalesce\(sum\(amount\) filter \(where to_bucket = 'escrow'\), 0\)/i,
    );
    expect(migration).toMatch(
      /coalesce\(sum\(amount\) filter \(where to_bucket = 'frozen'\), 0\)/i,
    );
    expect(migration).toMatch(
      /coalesce\(sum\(amount\) filter \(where to_bucket = 'paid_out'\), 0\)/i,
    );
    expect(migration).toMatch(
      /coalesce\(sum\(case when to_bucket = 'available' then amount else 0 end\), 0\)\s*-\s*coalesce\(sum\(case when from_bucket = 'available' then amount else 0 end\), 0\)/i,
    );
  });

  it("keeps the supplier authorization gate unchanged", () => {
    expect(migration).toMatch(
      /if v_supplier_id is null or not public\.is_supplier\(\) or not public\.is_approved_supplier\(\) then raise exception 'active approved supplier required' using errcode = '42501'/i,
    );
  });

  it("keeps the signature, volatility, security and grants", () => {
    expect(migration).toMatch(
      /create or replace function public\.get_supplier_finance\(\)\s*returns jsonb\s*language plpgsql stable security definer set search_path = public/i,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.get_supplier_finance\(\) from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.get_supplier_finance\(\) to authenticated/i,
    );
  });

  it("is additive only", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
    expect(migration).not.toMatch(/drop\s+function/i);
  });
});
