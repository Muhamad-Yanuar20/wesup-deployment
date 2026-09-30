import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { findMissingSupplierTransactionObjects, readSnapshot } from "./check-supplier-transaction-schema.mjs";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(env = process.env) {
  const path = resolve(ROOT, ".env");
  if (!existsSync(path)) return env;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function validUrl(value, { allowHttpLocalhost = false } = {}) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return true;
    return allowHttpLocalhost && parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function validatePaymentEnvironment(env = {}, { publicDeployment = false } = {}) {
  const failures = [];
  const supabaseUrl = typeof env.NEXT_PUBLIC_SUPABASE_URL === "string" ? env.NEXT_PUBLIC_SUPABASE_URL.trim() : "";
  const adminSecret = typeof env.SUPABASE_SECRET_KEY === "string" ? env.SUPABASE_SECRET_KEY.trim() : "";
  const legacyServiceRole = typeof env.SUPABASE_SERVICE_ROLE_KEY === "string" ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : "";
  const serverKey = typeof env.MIDTRANS_SERVER_KEY === "string" ? env.MIDTRANS_SERVER_KEY.trim() : "";
  const clientKey = typeof env.MIDTRANS_CLIENT_KEY === "string" ? env.MIDTRANS_CLIENT_KEY.trim() : "";
  const productionFlag = typeof env.MIDTRANS_IS_PRODUCTION === "string" ? env.MIDTRANS_IS_PRODUCTION.trim() : "";
  const publicSiteUrl = typeof env.NEXT_PUBLIC_SITE_URL === "string" ? env.NEXT_PUBLIC_SITE_URL.trim() : "";

  if (!validUrl(supabaseUrl)) failures.push("supabase_url");
  if (!adminSecret && !legacyServiceRole) failures.push("supabase_admin_key");
  if (!serverKey) failures.push("midtrans_server_key");
  if (!clientKey) failures.push("midtrans_client_key");
  if (productionFlag !== "true" && productionFlag !== "false") failures.push("midtrans_production_flag");
  if (publicSiteUrl && !validUrl(publicSiteUrl, { allowHttpLocalhost: true })) failures.push("public_site_url");
  if (publicDeployment && !publicSiteUrl) failures.push("public_site_url");

  return {
    ok: failures.length === 0,
    failures,
    adminKeySource: adminSecret ? "secret" : legacyServiceRole ? "service_role" : null,
    publicSiteConfigured: Boolean(publicSiteUrl),
  };
}

async function probeAdmin(env) {
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL.trim(), key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await client.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
  if (result.error) throw result.error;
}

async function probeSchema(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    return findMissingSupplierTransactionObjects(await readSnapshot(client));
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function main({ env = loadEnvFile({ ...process.env }), publicDeployment = process.argv.includes("--public") || env.NODE_ENV === "production" } = {}) {
  const configuration = validatePaymentEnvironment(env, { publicDeployment });
  if (!configuration.ok) {
    console.error(`Payment readiness failed. Missing or invalid: ${configuration.failures.join(", ")}.`);
    return 1;
  }
  if (!env.DATABASE_URL) {
    console.error("Payment readiness failed. Missing or invalid: database_url.");
    return 1;
  }
  try {
    await probeAdmin(env);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
    console.error(`Payment readiness failed. Supabase admin read-only probe${code ? ` (${code})` : ""}.`);
    return 1;
  }
  try {
    const missing = await probeSchema(env.DATABASE_URL);
    if (missing.length > 0) {
      console.error(`Payment readiness failed. Schema is not ready: ${missing.join(", ")}.`);
      return 1;
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
    console.error(`Payment readiness failed. Schema probe${code ? ` (${code})` : ""}.`);
    return 1;
  }
  console.log(`Payment readiness passed. Admin key source: ${configuration.adminKeySource}; Snap schema and read-only access are ready.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}