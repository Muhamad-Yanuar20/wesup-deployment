import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_MIGRATION = "20260916000000";
const REQUIRED_FUNCTIONS = [
  "materialize_supplier_batch",
  "get_supplier_batch_transaction",
];
const REQUIRED_COLUMNS = [
  "public.batches.capacity_quantity",
  "public.batches.payment_window_hours",
];
const REQUIRED_RELATIONS = [
  "public.payment_attempts",
  "public.batch_status_events",
  "public.supplier_ledger_entries",
  "public.supplier_payouts",
];
const REQUIRED_FUNCTION_DEFINITION = "close_batch_and_issue_invoices";

function isInvoiceUpsertQualified(definition) {
  return /insert\s+into\s+public\.payments\s+as\s+existing/i.test(definition)
    && /\bexisting\.status\b/i.test(definition)
    && !/case\s+when\s+status\s*=\s*'paid'/i.test(definition);
}

function loadEnv() {
  if (process.env.DATABASE_URL || !existsSync(resolve(ROOT, ".env"))) return;
  for (const raw of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function hasValue(values, expected) {
  return new Set(values).has(expected);
}

export function findMissingSupplierTransactionObjects(snapshot) {
  const missing = [];
  if (!hasValue(snapshot.migrationVersions, REQUIRED_MIGRATION)) missing.push(`migration:${REQUIRED_MIGRATION}`);
  for (const name of REQUIRED_FUNCTIONS) if (!hasValue(snapshot.functions, name)) missing.push(`function:public.${name}(uuid)`);
  for (const column of REQUIRED_COLUMNS) if (!hasValue(snapshot.columns, column)) missing.push(`column:${column}`);
  for (const relation of REQUIRED_RELATIONS) if (!hasValue(snapshot.relations, relation)) missing.push(`relation:${relation}`);
  if (snapshot.functionDefinitions !== undefined) {
    const definition = snapshot.functionDefinitions?.[REQUIRED_FUNCTION_DEFINITION] ?? "";
    if (!isInvoiceUpsertQualified(definition)) missing.push("function-definition:public.close_batch_and_issue_invoices(uuid,text,text,text)");
  }
  return missing;
}

export async function readSnapshot(client) {
  const migrations = await client.query("select version::text from supabase_migrations.schema_migrations where version = $1", [REQUIRED_MIGRATION]);
  const functions = await client.query("select proname from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and proname = any($1::text[])", [REQUIRED_FUNCTIONS]);
  const functionDefinitions = await client.query("select p.proname, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1", [REQUIRED_FUNCTION_DEFINITION]);
  const columns = await client.query("select table_schema || '.' || table_name || '.' || column_name as qualified_name from information_schema.columns where table_schema = 'public' and table_name = 'batches' and column_name = any($1::text[])", [["capacity_quantity", "payment_window_hours"]]);
  const relations = await client.query("select table_schema || '.' || table_name as qualified_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])", [REQUIRED_RELATIONS.map((relation) => relation.slice("public.".length))]);
  return {
    migrationVersions: migrations.rows.map((row) => row.version),
    functions: functions.rows.map((row) => row.proname),
    functionDefinitions: Object.fromEntries(functionDefinitions.rows.map((row) => [row.proname, row.definition])),
    columns: columns.rows.map((row) => row.qualified_name),
    relations: relations.rows.map((row) => row.qualified_name),
  };
}

export async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error("Supplier transaction schema check failed: DATABASE_URL is not set.");
    return 1;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const missing = findMissingSupplierTransactionObjects(await readSnapshot(client));
    if (missing.length > 0) {
      console.error(`Supplier transaction schema is not ready. Missing: ${missing.join(", ")}`);
      return 1;
    }
    console.log(`Supplier transaction schema is ready through migration ${REQUIRED_MIGRATION}.`);
    return 0;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
    console.error(`Supplier transaction schema check failed${code ? ` (${code})` : ""}.`);
    return 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
