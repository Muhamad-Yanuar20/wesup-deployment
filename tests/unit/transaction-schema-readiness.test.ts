import { describe, expect, it } from "vitest";
import { findMissingTransactionUxObjects, REQUIRED_COLUMNS, REQUIRED_FUNCTIONS, REQUIRED_TABLES } from "../../scripts/check-transaction-ux-schema.mjs";
import { transactionError } from "@/lib/transactions/api";

describe("transaction schema readiness", () => {
  const ready = () => ({ columns: [...REQUIRED_COLUMNS], functions: [...REQUIRED_FUNCTIONS],
    tables: REQUIRED_TABLES.map((name: string) => ({ name, rls: true, authenticatedSelect: true, serviceAccess: true })) });
  it("accepts the complete schema independent of migration history", () => {
    expect(findMissingTransactionUxObjects(ready())).toEqual([]);
  });
  it("rejects missing columns and private tables without RLS or grants", () => {
    const snapshot = ready();
    snapshot.columns = [];
    snapshot.tables[0] = { ...snapshot.tables[0], rls: false, authenticatedSelect: false };
    expect(findMissingTransactionUxObjects(snapshot)).toContain(`column:${REQUIRED_COLUMNS[0]}`);
    expect(findMissingTransactionUxObjects(snapshot)).toContain(`rls:${REQUIRED_TABLES[0]}`);
    expect(findMissingTransactionUxObjects(snapshot)).toContain(`grant:${REQUIRED_TABLES[0]}:authenticated:select`);
  });
  it("returns an explicit unavailable response for a missing publication RPC", async () => {
    const response = transactionError({ code: "PGRST202", message: "Could not find the function public.publish_supplier_offer" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "TRANSACTION_SCHEMA_NOT_READY" });
  });
  it("does not reclassify permission failures as missing schema", async () => {
    const response = transactionError({ code: "42501", message: "permission denied" });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("42501");
  });
});
