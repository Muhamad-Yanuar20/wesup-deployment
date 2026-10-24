// Local-only Supabase read adapter backed by real isolated PostgreSQL SQL.
// Never connects to a hosted database. Used by marketplace-availability.spec.ts.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { PGlite } from "../../node_modules/.cache/wesup-availability/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
const ids = {
  open: "10000000-0000-4000-8000-000000000001",
  expired: "10000000-0000-4000-8000-000000000002",
  full: "10000000-0000-4000-8000-000000000003",
};
await db.exec(`
  create role anon; create role authenticated;
  create table profiles(id uuid primary key, full_name text);
  create table supplier_profiles(user_id uuid, business_name text);
  create table batches(id uuid primary key, supplier_id uuid, title text, description text, category text, min_quantity integer,
    product_photo_url text, pickup_address text, latitude numeric, longitude numeric, created_at timestamptz default now(),
    status text, transaction_policy_version integer default 1, capacity_quantity integer, registration_closed_at timestamptz,
    close_reason text, final_registered_quantity bigint);
  create table batch_timeline(batch_id uuid, registration_opens_at timestamptz, registration_closes_at timestamptz);
  create table batch_tiers(batch_id uuid, tier_number integer, min_volume integer, max_volume integer, price_per_unit numeric);
  create table registrations(id uuid default gen_random_uuid(), batch_id uuid, quantity integer, status text);
  insert into profiles values('20000000-0000-4000-8000-000000000001','Supplier Bandung');
`);
await db.exec(await readFile("supabase/migrations/20260908000000_marketplace_dynamic_read_model.sql", "utf8"));
const migration = (await readdir("supabase/migrations")).find(file => file.endsWith("_marketplace_availability.sql"));
await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
for (const [state, id] of Object.entries(ids)) {
  await db.query("insert into batches(id,supplier_id,title,category,min_quantity,product_photo_url,pickup_address,latitude,longitude,status,capacity_quantity) values($1,'20000000-0000-4000-8000-000000000001',$2,'Makanan Siap Saji',1,'/file.svg','Bandung',-6.914744,107.60981,'published',10)", [id, `Beras ${state}`]);
  await db.query("insert into batch_timeline values($1,now()-interval '1 hour',now()+$2::interval)", [id, state === "expired" ? "-1 hour" : "1 hour"]);
  await db.query("insert into batch_tiers values($1,1,1,null,10000)", [id]);
  if (state === "full") await db.query("insert into registrations(batch_id,quantity,status) values($1,10,'registered')", [id]);
}
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    let raw = ""; for await (const part of req) raw += part;
    const body = raw ? JSON.parse(raw) : {};
    const path = new URL(req.url, "http://localhost").pathname;
    let result;
    if (path === "/__fixture") {
      await db.query("delete from registrations where batch_id=$1", [ids.open]);
      await db.query("update batch_timeline set registration_closes_at=now()+$1::interval where batch_id=$2", [body.action === "expire" ? "5 seconds" : "1 hour", ids.open]);
      if (body.action === "full") await db.query("insert into registrations(batch_id,quantity,status) values($1,10,'registered')", [ids.open]);
      result = { ok: true, ids };
    } else if (path === "/rest/v1/rpc/search_batches") {
      const keys = ["p_query", "p_categories", "p_lat", "p_lng", "p_radius_km", "p_min_price", "p_max_price", "p_limit", "p_offset"];
      result = (await db.query(`select * from search_batches(${keys.map((_, i) => `$${i + 1}`).join(",")})`, keys.map(key => body[key] ?? null))).rows;
    } else if (path === "/rest/v1/rpc/get_marketplace_batch") {
      result = (await db.query("select * from get_marketplace_batch($1,$2,$3)", [body.p_batch_id, body.p_lat ?? null, body.p_lng ?? null])).rows;
    } else if (path === "/rest/v1/rpc/get_offer_context") result = null;
    else if (path === "/rest/v1/batches") result = Object.values(ids).map(id => ({ id, transaction_policy_version: 1, capacity_quantity: 10, unit: "kg", payment_opening_policy: "fixed_cutoff", registration_closed_at: null, batch_timeline: null }));
    else { res.statusCode = 404; result = { error: "Fixture endpoint not found" }; }
    res.end(JSON.stringify(result, (_, value) => typeof value === "bigint" ? Number(value) : value));
  } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: String(error) })); }
});
await new Promise(resolve => server.listen(3198, "127.0.0.1", resolve));
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3199", "--hostname", "127.0.0.1"], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, MARKETPLACE_ISOLATED_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key", NEXT_PUBLIC_SITE_URL: "http://localhost:3199" },
});
async function close() { child.kill(); server.close(); await db.close(); }
process.on("SIGINT", close); process.on("SIGTERM", close);
child.on("exit", async code => { server.close(); await db.close(); process.exitCode = code ?? 0; });
