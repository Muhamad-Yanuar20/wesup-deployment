// Reuse the application's isolated schema/bootstrap and legitimate v2 join/cutoff
// scenarios, then exercise real payment RPCs for both transaction policy versions.
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const runtime=process.argv[2];
const {PGlite}=await import(pathToFileURL(runtime).href);
const {pgcrypto}=await import(pathToFileURL(runtime.replace('index.js','contrib/pgcrypto.js')).href);
const {pg_trgm}=await import(pathToFileURL(runtime.replace('index.js','contrib/pg_trgm.js')).href);
const db=new PGlite({extensions:{pgcrypto,pg_trgm}});
try {
 const existing=await readFile('scripts/test-transaction-ux-sql.mjs','utf8');
 let bootstrap=existing.slice(existing.indexOf('await db.exec(`'),existing.indexOf('await db.query("update public.registrations set status=\'paid\''));
 bootstrap=bootstrap.replace('capacityQuantity:10,pickupName:', 'capacityQuantity:10,earlyPaymentMinimumQuantity:10,pickupName:');
 bootstrap=bootstrap.replace("'accepted',true,'paymentOpeningPolicy'","'accepted',true,'earlyPaymentMinimumQuantity',10,'paymentOpeningPolicy'");
 bootstrap=bootstrap.replace('{...payload,description:', '{...payload,earlyPaymentMinimumQuantity:null,description:');
 const scenarios=`
 await asUser(''); await db.exec("select set_config('test.role','service_role',false)");
 const audit={_wesup_audit:{source:'payment_webhook',requestId:'00000000-0000-4000-8000-000000000001'},transaction_status:'settlement'};
 assert.equal((await query("select public.finalize_payment($1,'fixture-settlement',$2::jsonb) status",[registrationId,audit])).status,'paid');
 await assert.rejects(db.query("update public.registrations set status='cancelled' where id=$1",[registrationId]),/invalid registration status transition/);
 assert.equal((await query("select metadata->>'operation' source from public.registration_status_events where registration_id=$1 and to_status='paid' order by created_at desc limit 1",[registrationId])).source,'payment_webhook');
 console.log('PASS v2 settlement uses the real RPC, retains escrow, and records webhook source');
 const legacyBatch='90000000-0000-4000-8000-000000000001',legacyOrder='90000000-0000-4000-8000-000000000002';
 for(const table of ['batches','batch_timeline','registrations']) {
  const fields=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' and is_identity='NO' order by ordinal_position",[table])).rows.map(r=>r.column_name);
  const patch=table==='batches'?{id:legacyBatch,transaction_policy_version:1}:table==='batch_timeline'?{batch_id:legacyBatch}:{id:legacyOrder,batch_id:legacyBatch,status:'pending_payment'};
  const original=table==='registrations'?registrationId:batchId;
  if(table==='registrations')await db.exec('alter table public.registrations disable trigger prevent_registration_outside_window');
  const selector=table==='batch_timeline'?'batch_id':'id';
  await db.query('insert into public.'+table+'('+fields.join(',')+') select '+fields.map(f=>'clone.'+f).join(',')+' from public.'+table+' old cross join lateral jsonb_populate_record(null::public.'+table+',to_jsonb(old)||$2::jsonb) clone where old.'+selector+'=$1',[original,patch]);
  if(table==='registrations')await db.exec('alter table public.registrations enable trigger prevent_registration_outside_window');
 }
 await db.query("insert into public.payments(registration_id,midtrans_order_id,gross_amount,status) values($1,'WESUP-isolated-legacy',20000,'pending')",[legacyOrder]);
 assert.equal((await query("select public.finalize_payment($1,'fixture-legacy-settlement',$2::jsonb) status",[legacyOrder,audit])).status,'paid');
 await assert.rejects(db.query("update public.registrations set status='cancelled' where id=$1",[legacyOrder]),/invalid registration status transition/);
 assert.equal(Number((await query("select amount from public.escrow_holds where registration_id=$1",[legacyOrder])).amount),20000);
 console.log('PASS v1 settlement and cancellation protection use the same production RPCs');
 await asUser('90000000-0000-4000-8000-000000000099');
 await assert.rejects(db.query('select public.materialize_umkm_order($1)',[registrationId]),/order not found|owner|authorized|permission/);
 await assert.rejects(db.query("select public.cancel_supplier_batch($1,'fixture')",[batchId]),/batch not found|supplier|owner|authorized|permission/);
 console.log('PASS cross-account order and supplier access remain blocked');
 `;
 await new(Object.getPrototypeOf(async function(){}).constructor)('db','readFile','readdir','assert',bootstrap+scenarios)(db,readFile,readdir,assert);
} catch(error){console.error('Runtime fixture failed:',error.code||error.message,error.where||'');process.exitCode=1;}finally{await db.close();}
