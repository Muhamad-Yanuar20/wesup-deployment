// Isolated PostgreSQL/WASM regression harness. No credentials or external DB.
import { readFile, readdir } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { PGlite } from "../.codex/ux-v2-db/node_modules/@electric-sql/pglite/dist/index.js";
import { pgcrypto } from "../.codex/ux-v2-db/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js";
import { pg_trgm } from "../.codex/ux-v2-db/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js";

process.on("uncaughtException",e=>{console.error("SQL scenario failed:",e.message,e.where??"",e.internalQuery??"");process.exit(1);});
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage; create extension pgcrypto;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('test.role',true),''),'authenticated')$$;
  create table auth.users(id uuid primary key,email text,phone text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
  create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
`);
for (const file of (await readdir("supabase/migrations")).filter((x) => x.endsWith(".sql")).sort()) {
  // This remote-history reconciliation file repeats DDL from 20260909000000.
  if (file === "20260914000000_batch_pickup_name_audit.sql") continue;
  try { await db.exec(await readFile(`supabase/migrations/${file}`, "utf8")); }
  catch (error) { console.error(`Migration failed: ${file}: ${error.message} at ${error.position}`);console.error(error.internalQuery ?? (await readFile(`supabase/migrations/${file}`,"utf8")).slice(Number(error.position)-100,Number(error.position)+100)); process.exitCode = 1; await db.close(); process.exit(1); }
}
console.log("PASS: complete migration replay");

// Regression scenarios below run against the actual PL/pgSQL authorities.
const supplier="10000000-0000-4000-8000-000000000001", buyer="20000000-0000-4000-8000-000000000001";
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values('${supplier}','supplier@example.test','{"role":"supplier","full_name":"Supplier","phone":"08111111111"}'),('${buyer}','buyer@example.test','{"role":"umkm","full_name":"Buyer","phone":"08222222222"}');`);
await db.exec(`insert into public.supplier_profiles(user_id,business_name,address,latitude,longitude,verification_status) values('${supplier}','Toko','Bandung',-6.914744,107.60981,'approved') on conflict(user_id) do update set verification_status='approved';
  insert into public.umkm_profiles(user_id,business_name,address,latitude,longitude) values('${buyer}','UMKM','Bandung',-6.914744,107.60981) on conflict(user_id) do update set business_name='UMKM',address='Bandung',latitude=-6.914744,longitude=107.60981;`);
await db.exec(`update public.profiles set role='supplier' where id='${supplier}';`);
const asUser=async(id)=>db.query("select set_config('test.uid',$1,false)",[id]);
await asUser(supplier);
const draftId="30000000-0000-4000-8000-000000000001";
const query=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
const partial=await query("select public.save_supplier_offer_draft($1,'{\"title\":\"Beras\"}',1::smallint,null) item",[draftId]);
assert.equal(partial.item.payload.title,"Beras");
console.log("PASS: partial private draft");
await assert.rejects(()=>db.query("select public.save_supplier_offer_draft($1,'{}',1::smallint,0)",[draftId]),/changed/);
console.log("PASS: stale tab rejected");
const date=(await query("select (now() at time zone 'Asia/Jakarta')::date+4 as pickup_day")).pickup_day.toISOString().slice(0,10);
const payload={title:"Beras",category:"Sayur & Buah",description:"Beras segar",unit:"kg",capacityQuantity:10,pickupName:"Toko",pickupAddress:"Bandung",pickupLatitude:-6.914744,pickupLongitude:107.60981,tiers:[{minimumQuantity:1,pricePerUnit:10000},{minimumQuantity:5,pricePerUnit:9000}],schedule:{openingMode:"immediate",collectionDays:1,pickupStartsAt:`${date}T08:00:00+07:00`,pickupEndsAt:`${date}T20:00:00+07:00`}};
const complete=await query("select public.save_supplier_offer_draft($1,$2,4::smallint,1) item",[draftId,payload]);
await db.exec(`insert into storage.objects(bucket_id,name) values('wesup-public','products/${draftId}/test.webp');`);
const published=await query("select public.publish_supplier_offer($1,$2,'https://example.test/storage/v1/object/public/wesup-public/products/30000000-0000-4000-8000-000000000001/test.webp') id",[draftId,complete.item.revision]);
const batchId=published.id;
assert.equal((await query("select transaction_policy_version from public.batches where id=$1",[batchId])).transaction_policy_version,2);
assert.equal((await query("select public.publish_supplier_offer($1,$2,'https://example.test/storage/v1/object/public/wesup-public/products/30000000-0000-4000-8000-000000000001/test.webp') id",[draftId,complete.item.revision])).id,batchId);
console.log("PASS: atomic idempotent publication");
await asUser(buyer);
const consent=(await query("select jsonb_build_object('accepted',true,'maximumUnitPrice',10000,'unit','kg','pickupAddress','Bandung','paymentOpensAt',payment_opens_at,'paymentClosesAt',payment_closes_at,'pickupStartsAt',estimated_ready_at,'pickupEndsAt',pickup_ends_at) terms from public.batch_timeline where batch_id=$1",[batchId])).terms;
const joined=await query("select public.join_batch_v2($1,10,$2,null,null) item",[batchId,consent]);
const registrationId=joined.item.registrationId;
await query("select public.materialize_supplier_batch($1)",[batchId]);
assert.equal((await query("select status from public.batches where id=$1",[batchId])).status,"published");
await assert.rejects(()=>db.query("select public.close_batch_and_issue_invoices($1,'capacity_reached')",[batchId]),/cannot be advanced/);
await asUser(supplier);
await assert.rejects(()=>db.query("select public.cut_off_batch($1)",[batchId]),/still open|cannot be advanced/);
await asUser(buyer);
console.log("PASS: full capacity cannot advance payment");
await query("select public.withdraw_batch_registration($1)",[registrationId]);
const rejoined=await query("select public.join_batch_v2($1,2,$2,null,null) item",[batchId,consent]);
assert.equal(rejoined.item.registrationId,registrationId);
assert.equal((await query("select public.get_registration_volume_v2($1) item",[batchId])).item.quantity,2);
console.log("PASS: withdraw frees capacity and rejoin retains identity");

await asUser(supplier);
await assert.rejects(()=>db.query("select public.update_offer_content_v2($1,$2,$3)",[batchId,{...payload,capacityQuantity:11},published.id?"https://example.test/storage/v1/object/public/wesup-public/products/30000000-0000-4000-8000-000000000001/test.webp":null]),/locked/);
await db.query("select public.update_offer_content_v2($1,$2,$3)",[batchId,{...payload,description:"Beras pilihan"},"https://example.test/storage/v1/object/public/wesup-public/products/30000000-0000-4000-8000-000000000001/test.webp"]);
console.log("PASS: ever-participated commercial promises stay locked while descriptions remain editable");
await asUser(buyer);
// Owner-only time travel fixture; not a production permission bypass.
await db.exec("alter table public.batch_timeline disable trigger versioned_timeline_gate");
// Advance the fixture's timeline, while exercising transitions through production RPCs.
await db.query("update public.batch_timeline set registration_opens_at=now()-interval '3 days',registration_closes_at=now()-interval '1 second',payment_opens_at=now()-interval '1 second',payment_closes_at=now()+interval '1 day',estimated_ready_at=now()+interval '2 days',pickup_ends_at=now()+interval '2 days 8 hours' where batch_id=$1",[batchId]);
await query("select public.materialize_supplier_batch($1)",[batchId]);
assert.equal((await query("select status,final_amount from public.registrations where id=$1",[registrationId])).status,"pending_payment");
assert.equal(Number((await query("select final_amount from public.registrations where id=$1",[registrationId])).final_amount),20000);
console.log("PASS: cutoff locks base price when discount target is missed");
await db.query("update public.registrations set status='paid' where id=$1",[registrationId]);
await db.query("update public.payments set status='paid',paid_at=now() where registration_id=$1",[registrationId]);
await db.query("update public.batch_timeline set registration_opens_at=now()-interval '3 days',registration_closes_at=now()-interval '26 hours',payment_opens_at=now()-interval '26 hours',payment_closes_at=now()-interval '2 hours',effective_payment_opens_at=now()-interval '26 hours',effective_payment_closes_at=now()-interval '2 hours',estimated_ready_at=now()-interval '1 hour',pickup_ends_at=now()+interval '6 hours' where batch_id=$1",[batchId]);
await asUser(supplier);
const replacement=(await query("select public.propose_pickup_replacement($1,$2,$3,'Barang belum siap') id",[batchId,`${date}T08:00:00+07:00`,`${date}T12:00:00+07:00`])).id;
await asUser(buyer);
await query("select public.decide_pickup_replacement($1,$2,'wait')",[registrationId,replacement]);
await query("select public.decide_pickup_replacement($1,$2,'wait')",[registrationId,replacement]);
assert.equal((await query("select accepted_pickup_revision from public.registrations where id=$1",[registrationId])).accepted_pickup_revision,replacement);
assert.equal((await query("select public.materialize_umkm_order($1) status",[registrationId])).status,'paid');
console.log("PASS: explicit replacement acceptance is replay-safe and does not advance pickup");
await db.query("update public.pickup_replacements set starts_at=now()-interval '5 hours',ends_at=now()-interval '1 hour' where id=$1",[replacement]);
assert.equal((await query("select public.materialize_umkm_order($1) status",[registrationId])).status,'refund_pending');
await query("select public.materialize_umkm_order($1)",[registrationId]);
assert.equal(Number((await query("select count(*) count from public.refund_requests where registration_id=$1",[registrationId])).count),1);
assert.equal(Number((await query("select strike_count from public.umkm_profiles where user_id=$1",[buyer])).strike_count),0);
console.log("PASS: repeated supplier lateness queues one full refund without a buyer strike");

// A second invoice exercises provider uncertainty and verified disruption appeals.
await db.query("update public.registrations set status='pending_payment',cancellation_reason=null,payment_penalty_exempt=false where id=$1",[registrationId]);
await db.query("update public.payments set status='pending' where registration_id=$1",[registrationId]);
await asUser(supplier);
await query("select public.reconcile_batch_payment_window($1)",[batchId]);
assert.equal((await query("select cancellation_reason from public.registrations where id=$1",[registrationId])).cancellation_reason,'payment_deadline');
assert.equal(Number((await query("select strike_count from public.umkm_profiles where user_id=$1",[buyer])).strike_count),1);
console.log("PASS: payment sweep records an appealable cancellation reason");
await asUser(buyer);
const support=(await query("select public.request_transaction_support($1,null,'Gangguan pembayaran terverifikasi') id",[registrationId])).id;
const admin="40000000-0000-4000-8000-000000000001";
await db.exec(`insert into auth.users(id,email) values('${admin}','admin@example.test');update public.profiles set role='admin' where id='${admin}';`);
await asUser(admin);
await query("select public.resolve_transaction_support($1,'Provider mengalami gangguan terverifikasi',true,true)",[support]);
await query("select public.resolve_transaction_support($1,'Provider mengalami gangguan terverifikasi',true,true)",[support]);
assert.equal(Number((await query("select strike_count from public.umkm_profiles where user_id=$1",[buyer])).strike_count),0);
console.log("PASS: verified outage appeal reverses exactly one penalty");

// Time-control fixtures restore a paid invoice without changing production gates.
await db.query("update public.registrations set status='paid' where id=$1",[registrationId]);
await db.query("update public.pickup_replacements set starts_at=now()+interval '2 hours',ends_at=now()+interval '6 hours',ready_at=null where id=$1",[replacement]);
await asUser(supplier);
await query("select public.mark_supplier_batch_ready($1)",[batchId]);
await asUser(buyer);
await assert.rejects(()=>db.query("select * from public.generate_pickup_code($1)",[registrationId]),/not eligible/);
console.log("PASS: early readiness does not advance pickup");
await db.query("update public.pickup_replacements set starts_at=now()-interval '1 hour',ends_at=now()+interval '3 hours',ready_at=now()-interval '2 hours' where id=$1",[replacement]);
const credentials=await query("select * from public.generate_pickup_code($1)",[registrationId]);
assert.deepEqual(await query("select * from public.generate_pickup_code($1)",[registrationId]),credentials);
await asUser(supplier);
await assert.rejects(()=>db.query("select public.confirm_pickup($1,'qr','wrong-code')",[registrationId]),/invalid/);
assert.equal((await query("select status from public.registrations where id=$1",[registrationId])).status,'paid');
const rights=(await query("select public.get_offer_context($1) item",[batchId])).item.pickup_actions;
assert.equal(rights.find(row=>row.registration_id===registrationId).can_confirm,true);
await query("select public.confirm_pickup($1,'qr',$2)",[registrationId,credentials.qr_code_token]);
await assert.rejects(()=>db.query("select public.confirm_pickup($1,'qr',$2)",[registrationId,credentials.qr_code_token]),/already picked up/);
assert.equal(Number((await query("select count(*) count from public.pickup_events where registration_id=$1",[registrationId])).count),1);
assert.equal(Number((await query("select extract(epoch from auto_release_at-pickup_confirmed_at)/3600 hours from public.escrow_holds where registration_id=$1",[registrationId])).hours),24);
console.log("PASS: pickup credentials are stable, wrong/reused codes do not duplicate handover, escrow lasts 24 hours");

const buyer2='20000000-0000-4000-8000-000000000002';
await db.exec(`insert into auth.users(id,email) values('${buyer2}','buyer2@example.test');`);
await db.exec("alter table public.registrations disable trigger prevent_registration_outside_window");
const pendingPickup=(await query("insert into public.registrations(batch_id,umkm_id,quantity,status,final_amount,locked_tier_number,consented_at) values($1,$2,1,'paid',10000,1,now()) returning id",[batchId,buyer2])).id;
await db.exec("alter table public.registrations enable trigger prevent_registration_outside_window");
await db.query("insert into public.payments(registration_id,midtrans_order_id,gross_amount,status,paid_at) values($1,'WESUP-second-fixture',10000,'paid',now())",[pendingPickup]);
await query("select public.cancel_supplier_batch($1,'Darurat setelah sebagian pengambilan')",[batchId]);
assert.equal((await query("select status from public.registrations where id=$1",[registrationId])).status,'picked_up');
assert.equal((await query("select status from public.escrow_holds where registration_id=$1",[registrationId])).status,'held');
assert.equal((await query("select status from public.registrations where id=$1",[pendingPickup])).status,'refund_pending');
console.log("PASS: partial emergency cancellation preserves handed-over goods and their escrow");

await db.query("update public.batches set status='closed',ready_at=now()-interval '8 hours' where id=$1",[batchId]);
await db.query("update public.batch_timeline set registration_opens_at=now()-interval '3 days',registration_closes_at=now()-interval '31 hours',payment_opens_at=now()-interval '31 hours',payment_closes_at=now()-interval '7 hours',effective_payment_opens_at=now()-interval '31 hours',effective_payment_closes_at=now()-interval '7 hours',estimated_ready_at=now()-interval '6 hours',pickup_ends_at=now()-interval '1 hour' where batch_id=$1",[batchId]);
await db.query("update public.registrations set status='paid',cancellation_reason=null where id=$1",[pendingPickup]);
await db.query("insert into public.escrow_holds(registration_id,amount,status,pickup_confirmed_at,auto_release_at) values($1,10000,'held',null,null)",[pendingPickup]);
await asUser(buyer2);
assert.equal((await query("select public.materialize_umkm_order($1) status",[pendingPickup])).status,'no_show');
assert.equal((await query("select status from public.escrow_holds where registration_id=$1",[pendingPickup])).status,'forfeited');
console.log("PASS: no-show forfeits escrow only after a timely-ready agreed pickup period");

await db.query("update public.registrations set status='pending_payment',payment_penalty_exempt=false,cancellation_reason=null where id=$1",[pendingPickup]);
await db.query("update public.payments set status='pending' where registration_id=$1",[pendingPickup]);
const attempt=(await query("insert into public.payment_attempts(payment_id,provider_order_id,status,provider_status,idempotency_key) select id,'WESUP-uncertain','pending','creating','uncertain-fixture' from public.payments where registration_id=$1 returning id",[pendingPickup])).id;
assert.equal((await query("select public.materialize_umkm_order($1) status",[pendingPickup])).status,'pending_payment');
await asUser(supplier);
await query("select public.reconcile_batch_payment_window($1)",[batchId]);
assert.equal((await query("select status from public.registrations where id=$1",[pendingPickup])).status,'pending_payment');
console.log("PASS: creating provider attempt is not penalized at the payment deadline");
await db.query("update public.payment_attempts set status='expired',provider_status='expire' where id=$1",[attempt]);
await asUser(buyer2);
assert.equal((await query("select public.materialize_umkm_order($1) status",[pendingPickup])).status,'cancelled');
await db.exec("select set_config('test.role','service_role',false)");
await asUser('');
await db.query("select public.apply_midtrans_payment_event($1,'settlement','late-fixture','qris',null,'{}')",[attempt]);
assert.equal((await query("select status from public.registrations where id=$1",[pendingPickup])).status,'refund_pending');
await db.query("select public.apply_midtrans_payment_event($1,'settlement','late-fixture','qris',null,'{}')",[attempt]);
assert.equal(Number((await query("select count(*) count from public.refund_requests where registration_id=$1",[pendingPickup])).count),1);
console.log("PASS: late repeated settlement queues one refund without reopening pickup");
await db.exec("select set_config('test.role','authenticated',false)");

// Actual authenticated role, not the owner connection: private draft isolation.
await db.exec("alter table public.batch_timeline enable trigger versioned_timeline_gate; grant usage on schema public,auth to authenticated; set role authenticated;");
await asUser(buyer);
assert.equal(Number((await query("select count(*) count from public.supplier_offer_drafts where id=$1",[draftId])).count),0);
await assert.rejects(()=>db.query("select public.save_supplier_offer_draft($1,'{}',1::smallint,null)",[draftId]),/supplier/);
await db.exec("reset role");
console.log("PASS: authenticated RLS hides supplier drafts from other users");
await db.close();
