// Real PostgreSQL semantics in an isolated PGlite instance; no remote credentials.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const batch="11111111-1111-4111-8111-111111111111", order="22222222-2222-4222-8222-222222222222", payment="33333333-3333-4333-8333-333333333333", attempt="44444444-4444-4444-8444-444444444444";
try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create function public.is_admin() returns boolean language sql as $$select true$$;
 create type batch_status as enum ('published','closed','cancelled','takedown');
 create type registration_status as enum ('registered','pending_payment','cancelled','paid','picked_up','completed','refund_pending','refunded','no_show');
 create type payment_status as enum ('pending','failed','expired','paid','refunded');
 create table batches(id uuid primary key,status batch_status);
 create table batch_timeline(batch_id uuid,payment_closes_at timestamptz,effective_payment_closes_at timestamptz,registration_closes_at timestamptz);
 create table registrations(id uuid primary key,batch_id uuid,status registration_status,cancellation_reason text,payment_penalty_exempt boolean default false,umkm_id uuid,final_amount numeric,updated_at timestamptz);
 create table payments(id uuid primary key,registration_id uuid,status payment_status);
 create table payment_attempts(id uuid primary key,payment_id uuid,status payment_status,provider_status text,payment_type text,provider_fraud_status text,provider_transaction_id text,provider_payload jsonb,updated_at timestamptz);
 create table registration_status_events(registration_id uuid,from_status registration_status,to_status registration_status,source text,actor_id uuid,metadata jsonb);
 create function record_transaction_log(uuid,uuid,uuid,text,text,text,text,text,text,jsonb) returns void language sql as $$select$$;
 insert into batches values('${batch}','closed');
 insert into batch_timeline values('${batch}',now()-interval '1 day',now()+interval '12 hours',now()-interval '12 hours');
 insert into registrations(id,batch_id,status,final_amount) values('${order}','${batch}','pending_payment',7770000);
 insert into payments values('${payment}','${order}','pending');
 insert into payment_attempts(id,payment_id,status) values('${attempt}','${payment}','pending');`);
 await db.exec(await readFile("supabase/migrations/20261002000100_payment_continuation_guard.sql","utf8"));
 await db.exec(await readFile("supabase/migrations/20261002000300_payment_status_audit_context.sql","utf8"));
 await db.exec(`create trigger event_audit after update of status on registrations for each row execute function record_registration_status_event();`);
 await assert.rejects(db.exec(`update registrations set status='cancelled' where id='${order}'`),/payment window still open/);
 console.log("PASS cancellation before effective deadline is rejected");
 for(const status of ['deny','cancel','expire']) {
  await db.query("select apply_midtrans_payment_event($1,$2,null,null,null,$3::jsonb)",[attempt,status,{_wesup_audit:{source:'payment_reconciliation',requestId:'00000000-0000-4000-8000-000000000001'},transaction_status:status}]);
  assert.equal((await db.query("select status from registrations")).rows[0].status,'pending_payment');
  assert.equal((await db.query("select status from payments")).rows[0].status,'pending');
 }
 console.log("PASS provider failure affects attempt only, not invoice or registration");
 assert.equal((await db.query("select provider_payload from payment_attempts")).rows[0].provider_payload._wesup_audit,undefined);
 console.log('PASS audit envelope is stripped before storing provider payload');
 await db.exec("update payments set status='paid'; update payment_attempts set status='paid',provider_status='settlement'; update registrations set status='paid';");
 for(const status of ['deny','cancel','expire','pending']) await db.query("select apply_midtrans_payment_event($1,$2)",[attempt,status]);
 assert.deepEqual((await db.query("select status,provider_status from payment_attempts")).rows[0],{status:'paid',provider_status:'settlement'});
 console.log("PASS late failure cannot downgrade paid attempt");
 await db.exec("update registrations set status='pending_payment'; update payments set status='pending'; update payment_attempts set status='pending'; update batch_timeline set effective_payment_closes_at=now()-interval '1 second';");
 await assert.rejects(db.exec(`update registrations set status='cancelled' where id='${order}'`),/must be reconciled/);
 console.log("PASS unresolved payment blocks deadline cancellation");
 await db.exec("update payment_attempts set status='expired'; update registrations set status='cancelled';");
 assert.equal((await db.query("select cancellation_reason from registrations")).rows[0].cancellation_reason,'payment_deadline');
 assert.equal((await db.query("select source from registration_status_events where to_status='cancelled'")).rows[0].source,'cancellation:payment_deadline');
 console.log("PASS actual deadline cancellation records reason and source");
 await db.exec("update registrations set status='pending_payment',cancellation_reason=null; update batch_timeline set effective_payment_closes_at=now()+interval '12 hours'; update batches set status='takedown'; update registrations set status='cancelled';");
 assert.equal((await db.query("select cancellation_reason from registrations")).rows[0].cancellation_reason,'takedown');
 console.log("PASS legitimate takedown cancellation remains available");
} finally {await db.close();}
