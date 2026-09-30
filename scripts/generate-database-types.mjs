// Catalog generation via the existing DB connection; does not require Management
// API access or Docker. Credentials are loaded internally and never printed.
import nextEnv from "@next/env";
import pg from "pg";
import { writeFileSync } from "node:fs";
nextEnv.loadEnvConfig(process.cwd());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query("BEGIN TRANSACTION READ ONLY");
  const types = (await db.query("select t.oid,t.typname,t.typtype,t.typelem,n.nspname from pg_type t join pg_namespace n on n.oid=t.typnamespace")).rows;
  const typeMap = new Map(types.map((t) => [String(t.oid), t]));
  const enums = (await db.query("select t.typname,array_agg(e.enumlabel::text order by e.enumsortorder) as values from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname")).rows;
  const enumMap = new Map(enums.map((e) => [e.typname, e.values]));
  const primitive = (oid) => {
    const type = typeMap.get(String(oid));
    if (!type) return "unknown";
    if (type.typelem && Number(type.typelem) !== 0 && type.typname.startsWith("_")) return `(${primitive(type.typelem)})[]`;
    if (enumMap.has(type.typname)) return `Database["public"]["Enums"][${JSON.stringify(type.typname)}]`;
    if (["json", "jsonb"].includes(type.typname)) return "Json";
    if (["int2", "int4", "int8", "numeric", "float4", "float8", "oid"].includes(type.typname)) return "number";
    if (type.typname === "bool") return "boolean";
    if (type.typname === "void") return "undefined";
    return "string";
  };
  const tables = (await db.query("select c.oid,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m') order by c.relname")).rows;
  const columns = (await db.query("select a.attrelid,a.attname,a.atttypid,a.attnotnull,a.atthasdef,a.attidentity from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and a.attnum>0 and not a.attisdropped order by a.attrelid,a.attnum")).rows;
  const relationships = (await db.query(`select con.conrelid,con.conname,r.relname as referenced_relation,
    array(select attname::text from unnest(con.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.num order by ord) as columns,
    array(select attname::text from unnest(con.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=con.confrelid and a.attnum=k.num order by ord) as referenced_columns,
    exists(select 1 from pg_constraint u where u.conrelid=con.conrelid and u.contype in ('u','p') and u.conkey=con.conkey) as one_to_one
    from pg_constraint con join pg_class r on r.oid=con.confrelid join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and con.contype='f' order by con.conname`)).rows;
  const functions = (await db.query("select p.proname,p.proargnames,p.proargmodes::text[] as proargmodes,p.proallargtypes,p.proargtypes::oid[] as input_types,p.pronargdefaults,p.prorettype,p.proretset from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype) order by p.proname")).rows;
  const q = JSON.stringify;
  const tableTypes = (kind) => tables.filter((t) => kind === "Tables" ? t.relkind === "r" : t.relkind !== "r").map((table) => {
    const cols = columns.filter((c) => String(c.attrelid) === String(table.oid));
    const fields = (mode) => cols.map((c) => `${q(c.attname)}${mode === "Update" || (mode === "Insert" && (!c.attnotnull || c.atthasdef || c.attidentity)) ? "?" : ""}: ${primitive(c.atttypid)}${!c.attnotnull ? " | null" : ""};`).join("\n");
    const rels = relationships.filter((r) => String(r.conrelid) === String(table.oid)).map((r) => `{ foreignKeyName: ${q(r.conname)}; columns: ${q(r.columns)}; isOneToOne: ${r.one_to_one}; referencedRelation: ${q(r.referenced_relation)}; referencedColumns: ${q(r.referenced_columns)}; }`).join(",\n");
    return `${q(table.relname)}: { Row: {${fields("Row")}}; ${kind === "Tables" ? `Insert: {${fields("Insert")}}; Update: {${fields("Update")}};` : ""} Relationships: [${rels}]; };`;
  }).join("\n");
  const grouped = new Map();
  for (const fn of functions) {
    const all = fn.proallargtypes ?? fn.input_types;
    const inputIndexes = all.map((_, i) => i).filter((i) => !fn.proargmodes || ["i", "b", "v"].includes(fn.proargmodes[i]));
    const args = inputIndexes.map((i, index) => `${q(fn.proargnames?.[i] ?? `arg${index + 1}`)}${index >= inputIndexes.length - fn.pronargdefaults ? "?" : ""}: ${primitive(all[i])} | null;`).join(" ");
    const outputs = all.map((_, i) => i).filter((i) => fn.proargmodes && ["o", "b", "t"].includes(fn.proargmodes[i]));
    const rowType = tables.find((t) => typeMap.get(String(fn.prorettype))?.typname === t.relname);
    const returns = outputs.length ? `{${outputs.map((i) => `${q(fn.proargnames[i])}: ${primitive(all[i])};`).join(" ")}}` : rowType ? `Database["public"]["Tables"][${q(rowType.relname)}]["Row"]` : primitive(fn.prorettype);
    const value = { args: args ? `{${args}}` : "Record<PropertyKey, never>", returns: `${returns}${fn.proretset ? "[]" : ""}` };
    grouped.set(fn.proname, [...(grouped.get(fn.proname) ?? []), value]);
  }
  const views = tableTypes("Views");
  const generated = `// Generated from the active public schema by scripts/generate-database-types.mjs.\n// Do not edit by hand.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: {\nTables: {${tableTypes("Tables")}};\nViews: ${views ? `{${views}}` : "Record<string, never>"};\nFunctions: {${[...grouped].map(([name, rows]) => `${q(name)}: { Args: ${rows.map((r) => r.args).join(" | ")}; Returns: ${[...new Set(rows.map((r) => r.returns))].join(" | ")}; };`).join("\n")}};\nEnums: {${enums.map((e) => `${q(e.typname)}: ${e.values.map(q).join(" | ")};`).join("\n")}};\nCompositeTypes: Record<string, never>;\n} };\n`;
  await db.query("ROLLBACK");
  writeFileSync("types/database.generated.ts", generated);
  console.log(`Generated public schema types: ${tables.length} relations, ${grouped.size} functions, ${enums.length} enums.`);
} finally { await db.query("ROLLBACK").catch(() => undefined); await db.end(); }
