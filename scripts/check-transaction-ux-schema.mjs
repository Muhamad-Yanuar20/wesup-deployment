import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

export const REQUIRED_COLUMNS = ["batches.transaction_policy_version", "batch_timeline.pickup_ends_at",
  "registrations.cancellation_reason", "registrations.consent_terms", "registrations.accepted_pickup_revision", "registrations.payment_penalty_exempt"];
export const REQUIRED_TABLES = ["supplier_offer_drafts", "pickup_replacements", "pickup_replacement_decisions", "transaction_support_requests"];
export const REQUIRED_FUNCTIONS = ["save_supplier_offer_draft", "publish_supplier_offer", "join_batch_v2",
  "withdraw_batch_registration", "propose_pickup_replacement", "decide_pickup_replacement", "get_offer_context",
  "get_registration_context_v2", "get_registration_volume_v2", "mark_supplier_batch_ready", "materialize_umkm_orders",
  "materialize_supplier_order", "materialize_supplier_batch", "get_supplier_batch_transaction", "reconcile_batch_payment_window",
  "request_transaction_support", "resolve_transaction_support", "apply_midtrans_payment_event"];

export function findMissingTransactionUxObjects(snapshot) {
  const missing = [];
  for (const column of REQUIRED_COLUMNS) if (!snapshot.columns.includes(column)) missing.push(`column:${column}`);
  for (const fn of REQUIRED_FUNCTIONS) if (!snapshot.functions.includes(fn)) missing.push(`function:${fn}`);
  for (const name of REQUIRED_TABLES) {
    const table = snapshot.tables.find((value) => value.name === name);
    if (!table) { missing.push(`table:${name}`); continue; }
    if (!table.rls) missing.push(`rls:${name}`);
    if (!table.authenticatedSelect) missing.push(`grant:${name}:authenticated:select`);
    if (!table.serviceAccess) missing.push(`grant:${name}:service_role:select`);
  }
  return missing;
}

export async function readTransactionUxSnapshot(client) {
  const columns = await client.query("select table_name||'.'||column_name as name from information_schema.columns where table_schema='public'");
  const functions = await client.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'");
  const tables = await client.query(`select c.relname as name,c.relrowsecurity as rls,
    has_table_privilege('authenticated',c.oid,'SELECT') as "authenticatedSelect",
    has_table_privilege('service_role',c.oid,'SELECT') as "serviceAccess"
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[])`, [REQUIRED_TABLES]);
  return { columns: columns.rows.map((row) => row.name), functions: functions.rows.map((row) => row.proname), tables: tables.rows };
}

export async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) { console.error("Transaction schema check requires DATABASE_URL; deployment has not been verified."); return 1; }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    const missing = findMissingTransactionUxObjects(await readTransactionUxSnapshot(client));
    await client.query("ROLLBACK");
    if (missing.length) { console.error(`Transaction schema is not ready: ${missing.join(", ")}`); return 1; }
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key) { console.error("Transaction REST check requires Supabase URL and server key."); return 1; }
    const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await api.from("registrations").select("id,cancellation_reason,accepted_pickup_revision,batch:batches(transaction_policy_version,batch_timeline(pickup_ends_at),pickup_replacements(id))").limit(0);
    if (result.error) { console.error(`Transaction REST schema is not ready (${result.error.code}).`); return 1; }
    console.log("Transaction UX schema, RLS, grants and REST relationships are ready.");
    return 0;
  } catch (error) { console.error(`Transaction schema check failed (${error.code || "connection"}).`); return 1; }
  finally { await client.end().catch(() => undefined); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
