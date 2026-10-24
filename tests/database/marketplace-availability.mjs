// Real PostgreSQL SQL execution in an isolated in-memory PGlite database.
import { PGlite } from "../../node_modules/.cache/wesup-availability/node_modules/@electric-sql/pglite/dist/index.js";
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); };
const supplier = "11111111-1111-4111-8111-111111111111";
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
try {
  await db.exec(`
    create role anon; create role authenticated;
    create table profiles(id uuid primary key, full_name text);
    create table supplier_profiles(user_id uuid, business_name text);
    create table batches(id uuid primary key, supplier_id uuid, title text, description text, category text, min_quantity integer,
      product_photo_url text, pickup_address text, latitude numeric, longitude numeric, created_at timestamptz default now(),
      status text, transaction_policy_version integer default 2, capacity_quantity integer, registration_closed_at timestamptz,
      close_reason text, final_registered_quantity bigint);
    create table batch_timeline(batch_id uuid, registration_opens_at timestamptz, registration_closes_at timestamptz);
    create table batch_tiers(batch_id uuid, tier_number integer, min_volume integer, max_volume integer, price_per_unit numeric);
    create table registrations(id uuid default gen_random_uuid(), batch_id uuid, quantity integer, status text);
    insert into profiles values('${supplier}', 'Supplier');
    alter table registrations enable row level security;
    grant usage on schema public to anon, authenticated;
    grant select on registrations to anon, authenticated;
  `);
  await db.exec(await readFile("supabase/migrations/20260908000000_marketplace_dynamic_read_model.sql", "utf8"));
  async function batch({ status = "published", capacity = 10, version = 2, opens = "-1 hour", closes = "1 hour", max = null, quantity = 0, registrationStatus = "registered" } = {}) {
    const id = crypto.randomUUID();
    await query("insert into batches(id,supplier_id,title,category,min_quantity,pickup_address,latitude,longitude,status,capacity_quantity,transaction_policy_version) values($1,$2,'Beras','Bahan Pokok',3,'Bandung',-6.9,107.6,$3,$4,$5)", [id, supplier, status, capacity, version]);
    await query("insert into batch_timeline values($1,now()+$2::interval,now()+$3::interval)", [id, opens, closes]);
    await query("insert into batch_tiers values($1,1,1,$2,10000)", [id, max]);
    if (quantity) await query("insert into registrations(batch_id,quantity,status) values($1,$2,$3)", [id, quantity, registrationStatus]);
    return id;
  }
  const expired = await batch({ closes: "-1 second" });
  const full = await batch({ quantity: 10 });
  check((await query("select * from search_batches() where id=$1", [expired])).length === 1, "RED evidence: incumbent search exposes an expired published batch");
  check((await query("select * from search_batches() where id=$1", [full])).length === 1, "RED evidence: incumbent search exposes a full published batch");
  const migration = (await readdir("supabase/migrations")).find(file => file.endsWith("_marketplace_availability.sql"));
  await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
  const detail = async id => (await query("select * from get_marketplace_batch($1)", [id]))[0];
  check(!(await detail(expired)).can_register && (await detail(expired)).unavailable_reason === "expired", "expired detail explains unavailability without waiting for materialization");
  check((await detail(full)).unavailable_reason === "full", "full detail explains capacity exhaustion");
  const open = await batch({ quantity: 3 });
  check((await detail(open)).can_register && (await detail(open)).remaining_quantity === 7, "tier target reached is not capacity reached");
  const future = await batch({ opens: "1 minute" });
  check((await detail(future)).unavailable_reason === "not_open", "future offer cannot be joined");
  await db.exec("begin");
  // A DO statement keeps statement_timestamp identical for writes and reads.
  await db.exec(`do $$ begin
    update batch_timeline set registration_opens_at=statement_timestamp() where batch_id='${future}';
    if not (select can_register from get_marketplace_batch('${future}')) then raise exception 'opening must be inclusive'; end if;
    update batch_timeline set registration_closes_at=statement_timestamp() where batch_id='${future}';
    if (select can_register from get_marketplace_batch('${future}')) then raise exception 'cutoff must be exclusive'; end if;
  end $$;`);
  check(true, "exact opening boundary is inclusive");
  check(true, "exact cutoff is exclusive");
  await db.exec("rollback");
  check((await detail(await batch({ quantity: 11 }))).unavailable_reason === "full", "over-capacity data never appears available");
  check((await detail(await batch({ capacity: null, max: 8, version: 1, quantity: 8 }))).unavailable_reason === "full", "finite legacy tiers define capacity");
  check((await detail(await batch({ capacity: null, max: null, version: 1, quantity: 100 }))).can_register, "unbounded legacy tier has no invented limit");
  check((await detail(await batch({ version: 1, quantity: 10, registrationStatus: "paid" }))).unavailable_reason === "full", "legacy paid registrations retain capacity");
  check((await detail(await batch({ quantity: 10, registrationStatus: "cancelled" }))).can_register, "cancelled reservations do not consume capacity");
  await query("update registrations set status='cancelled' where batch_id=$1", [full]);
  check((await detail(full)).can_register, "withdrawal restores capacity during collection");
  await query("update batches set status='closed',registration_closed_at=now(),close_reason='capacity_reached' where id=$1", [full]);
  check(!(await detail(full)).can_register, "withdrawal never reopens a permanently closed batch");
  for (const status of ["draft", "cancelled", "takedown"]) check(await detail(await batch({ status })) === undefined, `${status} remains private/unavailable`);
  check((await detail(await batch({ status: "completed" }))).unavailable_reason === "closed", "completed link shows a closed state");
  await db.exec("set role anon");
  check((await query("select * from registrations")).length === 0, "anonymous callers cannot read participant rows");
  const listed = await query("select * from search_batches(p_limit=>50)");
  check(listed.length > 0 && listed.every(row => row.can_register), "anonymous search exposes only available aggregate rows");
  check(listed.every(row => Number(row.total_count) === listed.length), "total count excludes expired and full rows before pagination");
  const page = await query("select * from search_batches(p_limit=>1,p_offset=>1)");
  check(page.length === 1 && Number(page[0].total_count) === listed.length, "pagination uses the filtered total");
  await assert.rejects(() => query("select * from private.marketplace_availability(null)"));
  check(true, "private helper cannot be called by anonymous users");
  console.log(`${checks} SQL checks passed`);
} finally { await db.close(); }
