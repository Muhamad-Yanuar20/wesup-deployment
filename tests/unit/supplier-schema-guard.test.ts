import { describe, expect, it } from "vitest";
import { findMissingSupplierTransactionObjects, readSnapshot } from "../../scripts/check-supplier-transaction-schema.mjs";

describe("Supplier transaction schema guard", () => {
  it("reports missing migration, RPC, column, and relation metadata", () => {
    const missing = findMissingSupplierTransactionObjects({
      migrationVersions: ["20260914010000"],
      functions: ["materialize_supplier_batch"],
      columns: ["public.batches.capacity_quantity"],
      relations: ["public.payment_attempts"],
    });
    expect(missing).toEqual([
      "migration:20260916000000",
      "function:public.get_supplier_batch_transaction(uuid)",
      "column:public.batches.payment_window_hours",
      "relation:public.batch_status_events",
      "relation:public.supplier_ledger_entries",
      "relation:public.supplier_payouts",
    ]);
  });

  it("returns no missing objects when the required schema is present", () => {
    expect(findMissingSupplierTransactionObjects({
      migrationVersions: ["20260916000000"],
      functions: ["materialize_supplier_batch", "get_supplier_batch_transaction"],
      columns: ["public.batches.capacity_quantity", "public.batches.payment_window_hours"],
      relations: ["public.payment_attempts", "public.batch_status_events", "public.supplier_ledger_entries", "public.supplier_payouts"],
      functionDefinitions: { close_batch_and_issue_invoices: "insert into public.payments as existing ... existing.status" },
    })).toEqual([]);
  });

  it("reports an invoice RPC definition that still has an unqualified status reference", () => {
    const missing = findMissingSupplierTransactionObjects({
      migrationVersions: ["20260916000000"],
      functions: ["materialize_supplier_batch", "get_supplier_batch_transaction"],
      columns: ["public.batches.capacity_quantity", "public.batches.payment_window_hours"],
      relations: ["public.payment_attempts", "public.batch_status_events", "public.supplier_ledger_entries", "public.supplier_payouts"],
      functionDefinitions: { close_batch_and_issue_invoices: "insert into public.payments (...) case when status = 'paid' then status else excluded.status end" },
    });
    expect(missing.some((value) => value.startsWith("function-definition:public.close_batch_and_issue_invoices"))).toBe(true);
  });

  it("does not issue concurrent queries through one PostgreSQL client", async () => {
    let active = false;
    const client = {
      query: async (sql: string) => {
        if (active) throw new Error("concurrent query");
        active = true;
        await new Promise((resolve) => setTimeout(resolve, 0));
        active = false;
        if (sql.includes("schema_migrations")) return { rows: [{ version: "20260916000000" }] };
        if (sql.includes("pg_get_functiondef")) return { rows: [{ proname: "close_batch_and_issue_invoices", definition: "insert into public.payments as existing ... existing.status" }] };
        if (sql.includes("pg_proc")) return { rows: [{ proname: "materialize_supplier_batch" }, { proname: "get_supplier_batch_transaction" }] };
        if (sql.includes("information_schema.columns")) return { rows: [{ qualified_name: "public.batches.capacity_quantity" }, { qualified_name: "public.batches.payment_window_hours" }] };
        return { rows: [{ qualified_name: "public.payment_attempts" }, { qualified_name: "public.batch_status_events" }, { qualified_name: "public.supplier_ledger_entries" }, { qualified_name: "public.supplier_payouts" }] };
      },
    };
    await expect(readSnapshot(client)).resolves.toMatchObject({ migrationVersions: ["20260916000000"], functionDefinitions: { close_batch_and_issue_invoices: expect.stringContaining("existing.status") } });
  });
});
