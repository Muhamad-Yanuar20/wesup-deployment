import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260915100000_supplier_batch_transactions.sql"),
  "utf8",
);

describe("Supplier batch transaction migration contract", () => {
  it("is additive and adds capacity/payment-window fields", () => {
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
    expect(migration).toMatch(/add column if not exists capacity_quantity/i);
    expect(migration).toMatch(/add column if not exists payment_window_hours/i);
    expect(migration).toMatch(/capacity_quantity.*check/i);
    expect(migration).toMatch(/payment_window_hours.*3.*6.*12.*24/i);
    expect(migration).toMatch(/effective_payment_opens_at/i);
    expect(migration).toMatch(/effective_payment_closes_at/i);
  });

  it("creates append-only batch events and supplier financial tables", () => {
    for (const tableName of ["batch_status_events", "supplier_ledger_entries", "supplier_payouts"]) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${tableName}`, "i"));
    }
    expect(migration).toMatch(/supplier_ledger_entries.*idempotency/i);
    expect(migration).toMatch(/supplier_payouts.*available/i);
    expect(migration).toMatch(/create trigger.*batch_status/i);
  });

  it("protects commercial fields and supplier-owned rows with RLS", () => {
    expect(migration).toMatch(/commercial.*locked|locked.*commercial/i);
    expect(migration).toMatch(/supplier_ledger_entries.*enable row level security/i);
    expect(migration).toMatch(/supplier_payouts.*enable row level security/i);
    expect(migration).toMatch(/supplier_id = auth\.uid\(\)/i);
    expect(migration).toMatch(/drop policy if exists "batches_supplier_capability_all"/i);
    expect(migration).toMatch(/drop policy if exists "batch_tiers_supplier_capability_all"/i);
    expect(migration).toMatch(/drop policy if exists "batch_timeline_supplier_capability_all"/i);
    expect(migration).toMatch(/drop policy if exists "supplier_bank_accounts_capability_all"/i);
  });

  it("exposes the transactional Supplier lifecycle RPCs", () => {
    for (const functionName of [
      "close_batch_and_issue_invoices",
      "materialize_supplier_batch",
      "mark_supplier_batch_ready",
      "cancel_supplier_batch",
      "request_supplier_payout",
      "complete_supplier_payout",
    ]) {
      expect(migration).toMatch(new RegExp(`create or replace function public\\.${functionName}`, "i"));
    }
    expect(migration).toMatch(/'capabilities'[\s\S]*jsonb_build_object/);
  });
});
