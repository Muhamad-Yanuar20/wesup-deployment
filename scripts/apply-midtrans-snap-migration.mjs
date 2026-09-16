import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const VERSION = "20260917000000";
const MIGRATION_NAME = "midtrans_snap_checkout";
const MIGRATION_PATH = path.join(ROOT, "supabase", "migrations", `${VERSION}_${MIGRATION_NAME}.sql`);

function loadEnv() {
  if (process.env.DATABASE_URL || !fs.existsSync(path.join(ROOT, ".env"))) return;
  for (const raw of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function backupPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wesup-midtrans-snap-")), "schema-migrations.json");
}

async function main() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const columns = await client.query("select column_name,data_type,udt_name from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position", ["supabase_migrations", "schema_migrations"]);
    if (columns.rows.length === 0) throw new Error("supabase_migrations.schema_migrations is unavailable");
    const history = await client.query("select version::text,name,statements from supabase_migrations.schema_migrations order by version");
    const snapshotFile = backupPath();
    fs.writeFileSync(snapshotFile, JSON.stringify(history.rows, null, 2), { encoding: "utf8", mode: 0o600 });
    const existing = history.rows.find((row) => String(row.version) === VERSION);
    console.log(JSON.stringify({ version: VERSION, alreadyApplied: Boolean(existing), migrationRows: history.rows.length, backup: snapshotFile }));
    if (process.argv.includes("--dry-run") || existing) return;
    if (!process.argv.includes("--apply")) {
      console.log("Dry run only. Re-run with --apply to execute the migration.");
      return;
    }
    await client.query("begin");
    await client.query(sql);
    const statementsColumn = columns.rows.find((row) => row.column_name === "statements");
    const statementValue = statementsColumn?.data_type === "ARRAY" || statementsColumn?.udt_name?.startsWith("_") ? [sql] : sql;
    await client.query("insert into supabase_migrations.schema_migrations (version,name,statements) values ($1,$2,$3)", [VERSION, MIGRATION_NAME, statementValue]);
    await client.query("commit");
    console.log(`Applied migration ${VERSION}.`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

try {
  await main();
} catch (error) {
  if (error && typeof error === "object") { const detail = error; console.error(JSON.stringify({ message: detail.message, code: detail.code, position: detail.position, detail: detail.detail, hint: detail.hint })); } else console.error("Migration failed");
  process.exitCode = 1;
}
