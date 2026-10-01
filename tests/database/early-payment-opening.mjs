// Isolated PostgreSQL runtime; no environment credentials or external database are used.
// Install @electric-sql/pglite in a temporary directory and pass its dist/index.js path.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
let checks = 0;
const check = (condition, description) => { assert.ok(condition, description); checks++; console.log(`PASS ${description}`); };
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const fail = async (operation, description) => { await assert.rejects(operation); checks++; console.log(`PASS ${description}`); };
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
    create table public.profiles(id uuid primary key,role text,status text default 'active',full_name text);
    create table public.supplier_profiles(user_id uuid primary key,verification_status text);
    create table public.umkm_profiles(user_id uuid primary key,business_name text,address text,latitude numeric,longitude numeric);
    create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
    create function public.is_approved_supplier() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles p join public.supplier_profiles s on p.id=s.user_id where p.id=auth.uid() and p.role='supplier' and p.status='active' and s.verification_status='approved')$$;
    create table public.batches(id uuid primary key default gen_random_uuid(),supplier_id uuid references public.profiles(id),title text,description text,category text,min_quantity integer default 25,capacity_quantity integer default 100,unit text default 'kg',payment_window_hours integer default 24,product_photo_url text,pickup_name text,pickup_address text,latitude numeric,longitude numeric,status text default 'published',transaction_policy_version integer default 2,payment_opening_policy text default 'fixed_cutoff',registration_closed_at timestamptz,close_reason text,final_registered_quantity integer,locked_tier_number integer,locked_unit_price numeric,invoices_issued_at timestamptz,ready_at timestamptz,updated_at timestamptz);
    create table public.batch_timeline(batch_id uuid primary key references public.batches(id),registration_opens_at timestamptz,registration_closes_at timestamptz,payment_opens_at timestamptz,payment_closes_at timestamptz,effective_payment_opens_at timestamptz,effective_payment_closes_at timestamptz,estimated_ready_at timestamptz,pickup_ends_at timestamptz);
    create table public.batch_tiers(batch_id uuid references public.batches(id),tier_number integer,min_volume integer,max_volume integer,price_per_unit numeric);
    create table public.registrations(id uuid primary key default gen_random_uuid(),batch_id uuid references public.batches(id),umkm_id uuid references public.profiles(id),quantity integer,status text default 'registered',consented_at timestamptz default clock_timestamp(),consent_terms jsonb,consent_latitude numeric,consent_longitude numeric,cancellation_reason text,accepted_pickup_revision uuid,locked_tier_number integer,locked_price_per_unit numeric,final_amount numeric,updated_at timestamptz,unique(batch_id,umkm_id));
    create table public.payments(registration_id uuid unique references public.registrations(id),midtrans_order_id text,gross_amount numeric,status text,updated_at timestamptz);
    create table public.notifications(user_id uuid,type text,title text,message text,data jsonb);
    create table public.admin_audit_logs(admin_id uuid,action_type text,target_type text,target_id uuid,details jsonb,ip_address text,user_agent text);
    create table public.pickup_replacements(id uuid, batch_id uuid,revision integer,starts_at timestamptz,ends_at timestamptz,ready_at timestamptz);
    create table public.supplier_offer_drafts(id uuid primary key,supplier_id uuid,revision integer,payload jsonb,published_batch_id uuid,updated_at timestamptz);
    create table storage.objects(bucket_id text,name text);
    grant select on public.batches,public.registrations,public.profiles to authenticated;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on all functions in schema auth to anon,authenticated;
  `);
  const previous = await readFile("supabase/migrations/20260930211221_payment_clarity_capacity_opening.sql", "utf8");
  const oldVolume = previous.match(/CREATE OR REPLACE FUNCTION public.get_registration_volume_v2\(.*?\$\$;/is)?.[0];
  assert.ok(oldVolume);
  await db.exec(oldVolume);
  // Real validators from their incumbent migrations, rather than mocks of their return values.
  for (const [file, name] of [["20260909010000_supplier_catalog_ownership_contract.sql", "validate_catalog_tiers"], ["20260930000000_transaction_ux_v2.sql", "assert_pickup_window"]]) {
    const source = await readFile(`supabase/migrations/${file}`, "utf8");
    const fn = source.match(new RegExp(`create (?:or replace )?function public\\.${name}\\(.*?\\$\\$;`, "is"));
    if (fn) await db.exec(fn[0]);
  }
  await db.exec(await readFile("supabase/migrations/20261001000100_early_payment_opening.sql", "utf8"));
  check(true, "entire additive migration compiles on PostgreSQL");
  const users = {};
  for (const [key, role] of [["owner", "supplier"], ["other", "supplier"], ["a", "umkm"], ["b", "umkm"], ["c", "umkm"]]) {
    const id = crypto.randomUUID(); users[key] = id;
    await q("insert into profiles(id,role,full_name) values($1,$2,$2)", [id, role]);
    if (role === "supplier") await q("insert into supplier_profiles values($1,'approved')", [id]);
    else await q("insert into umkm_profiles values($1,'Usaha','Bandung',-6.9,107.6)", [id]);
  }
  const user = async name => q("select set_config('app.user',$1,false)", [users[name]]);
  const rpc = async (fn, args) => (await q(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args))[0].result;
  async function batch({ minimum = null, version = 2, policy = "fixed_cutoff" } = {}) {
    const id = (await q("insert into batches(supplier_id,title,min_quantity,transaction_policy_version,payment_opening_policy,early_payment_minimum_quantity,unit,pickup_address) values($1,'Beras',25,$2,$3,$4,'kg','Bandung') returning id", [users.owner, version, policy, minimum]))[0].id;
    await q("insert into batch_timeline values($1,now()-interval '1 hour',now()+interval '2 days',now()+interval '2 days',now()+interval '3 days',null,null,now()+interval '4 days',now()+interval '4 days 8 hours')", [id]);
    await q("insert into batch_tiers values($1,1,1,24,10000),($1,2,25,null,8000)", [id]);
    return id;
  }
  const context = id => rpc("get_early_payment_context", [id]);
  async function join(id, who, quantity, terms = {}) {
    await user(who);
    const schedule = (await q("select * from batch_timeline where batch_id=$1", [id]))[0];
    const config = (await q("select * from batches where id=$1", [id]))[0];
    return rpc("join_batch_v2", [id, quantity, { accepted: true, paymentOpeningPolicy: config.payment_opening_policy, maximumUnitPrice: 10000, unit: "kg", pickupAddress: "Bandung", paymentOpensAt: schedule.payment_opens_at, paymentClosesAt: schedule.payment_closes_at, pickupStartsAt: schedule.estimated_ready_at, pickupEndsAt: schedule.pickup_ends_at, ...terms }, null, null]);
  }
  function preview(c) { return { registeredQuantity: c.registeredQuantity, participants: c.participants, tierNumber: c.tierNumber, unitPrice: c.unitPrice, proposalId: c.proposal?.id ?? null, proposalRevision: c.proposal?.revision ?? null }; }
  const direct = await batch({ minimum: 40, policy: "capacity_or_cutoff" });
  await fail(() => join(direct, "a", 20), "join requires explicit target consent");
  check((await q("select count(*)::int as n from registrations where batch_id=$1", [direct]))[0].n === 0, "failed consent rolls back registration");
  await join(direct, "a", 20, { earlyPaymentMinimumQuantity: 40 });
  await user("owner");
  check(!(await context(direct)).canOpen, "below-target volume cannot close");
  await fail(() => rpc("close_batch_and_issue_invoices", [direct, "supplier_manual", null, null]), "direct RPC cannot bypass minimum");
  await fail(() => q("update batches set early_payment_minimum_quantity=20 where id=$1", [direct]), "target locked after first participant");
  await join(direct, "b", 20, { earlyPaymentMinimumQuantity: 40 });
  await user("owner");
  const before = await context(direct);
  check(before.canOpen && before.registeredQuantity === 40, "exact independent target authorizes original-consent offer");
  await fail(() => rpc("confirm_early_payment_close", [direct, { ...preview(before), unitPrice: 9000 }, null, null]), "stale price preview rejected");
  const pickup = (await q("select estimated_ready_at from batch_timeline where batch_id=$1", [direct]))[0].estimated_ready_at;
  const closed = await rpc("confirm_early_payment_close", [direct, preview(before), null, null]);
  check(Date.parse(closed.paymentClosesAt) - Date.parse(closed.paymentOpensAt) === 86400000, "payment opens for exactly 24 hours");
  check(closed.unitPrice === 8000 && closed.invoiceCount === 2, "actual tier locked and invoices issued atomically");
  check((await q("select estimated_ready_at from batch_timeline where batch_id=$1", [direct]))[0].estimated_ready_at.getTime() === pickup.getTime(), "pickup promise is unchanged");
  const repeated = await rpc("confirm_early_payment_close", [direct, preview(before), null, null]);
  check(repeated.idempotent && repeated.paymentClosesAt === closed.paymentClosesAt, "repeated close returns same effective deadline");
  check((await q("select count(*)::int as n from notifications where data->>'batch_id'=$1 and type='payment_due'", [direct]))[0].n === 2, "payment notices issued once");
  await user("other");
  await fail(() => rpc("confirm_early_payment_close", [direct, preview(before), null, null]), "stranger cannot obtain idempotent close result");
  await fail(() => rpc("close_batch_and_issue_invoices", [direct, "supplier_manual", null, null]), "legacy RPC also checks owner before idempotent result");

  await q("select set_config('app.user','',false)");
  await fail(() => context(direct), "anonymous caller cannot read closed private context");
  await user("owner");
  const rollback = await batch({ minimum: 1 });
  await join(rollback, "a", 1, { earlyPaymentMinimumQuantity: 1 });
  await user("owner");
  await db.exec("create function fail_invoice_test() returns trigger language plpgsql as $$begin raise exception 'isolated invoice failure'; end$$; create trigger fail_invoice_test before insert on payments for each row execute function fail_invoice_test()");
  await fail(() => rpc("confirm_early_payment_close", [rollback, preview(before), null, null]), "stale confirmation cannot close another volume");
  const rollbackPreview = preview(await context(rollback));
  await fail(() => rpc("confirm_early_payment_close", [rollback, rollbackPreview, null, null]), "invoice failure rolls back close transaction");
  check((await q("select status from batches where id=$1", [rollback]))[0].status === "published" && (await q("select status from registrations where batch_id=$1", [rollback]))[0].status === "registered" && (await q("select count(*)::int n from notifications where data->>'batch_id'=$1", [rollback]))[0].n === 0, "rollback preserves phase and issues no payment notice");
  await db.exec("drop trigger fail_invoice_test on payments; drop function fail_invoice_test()");

  const active = await batch();
  const a = await join(active, "a", 20); const b = await join(active, "b", 20);
  await user("owner");
  const proposal = (await rpc("configure_early_payment", [active, 40, crypto.randomUUID()])).proposal;
  check(proposal.revision === 1 && !(await context(active)).canOpen, "active offers wait for unanimous consent");
  await user("a");
  await rpc("decide_early_payment", [a.registrationId, proposal.id, 1, "accepted"]);
  await user("owner"); check(!(await context(active)).canOpen, "partial approval is insufficient");
  await user("other"); await fail(() => rpc("decide_early_payment", [b.registrationId, proposal.id, 1, "accepted"]), "decision cannot target another buyer");
  await user("b"); await q("update profiles set status='suspended_temporary' where id=$1", [users.b]);
  await rpc("decide_early_payment", [b.registrationId, proposal.id, 1, "accepted"]);
  await user("owner"); check((await context(active)).canOpen, "suspended buyer can consent to an existing transaction");
  check((await q("select status from batches where id=$1", [active]))[0].status === "published", "last approval does not automatically open payment");
  await fail(() => join(active, "c", 5), "new entrant must consent to current proposal");
  await join(active, "c", 5, { earlyPaymentProposalId: proposal.id, earlyPaymentProposalRevision: 1 });
  await user("owner"); check((await context(active)).accepted === 3, "join records proposal approval in same transaction");
  await q("update registrations set status='cancelled',cancellation_reason='buyer_withdrawal' where id=$1", [a.registrationId]);
  check(!(await context(active)).canOpen, "withdrawal recomputes real volume");
  await join(active, "a", 20, { earlyPaymentProposalId: proposal.id, earlyPaymentProposalRevision: 1 });
  await user("owner"); check((await context(active)).accepted === 3, "rejoin refreshes consent timestamp");
  const revision = (await rpc("configure_early_payment", [active, 35, crypto.randomUUID()])).proposal;
  check(revision.revision === 2 && (await context(active)).accepted === 0, "changed proposal requires fresh approval");
  await user("a"); await fail(() => rpc("decide_early_payment", [a.registrationId, proposal.id, 1, "accepted"]), "old proposal cannot authorize current revision");
  await rpc("decide_early_payment", [a.registrationId, revision.id, 2, "rejected"]);
  await user("owner"); check(!(await context(active)).canOpen && (await context(active)).proposal.status === "rejected", "refusal blocks proposal without changing original policy");
  check((await q("select payment_opening_policy,status from batches where id=$1", [active]))[0].payment_opening_policy === "fixed_cutoff", "active batch original policy stays unchanged");
  await rpc("cancel_early_payment_proposal", [active, revision.id, 2]);
  await fail(() => rpc("configure_early_payment", [active, 101, crypto.randomUUID()]), "target cannot exceed capacity");
  await q("update batch_timeline set registration_closes_at=now()-interval '1 second' where batch_id=$1", [active]);
  await fail(() => rpc("configure_early_payment", [active, 40, crypto.randomUUID()]), "cutoff blocks new proposal");
  const cutoffClose = await rpc("close_batch_and_issue_invoices", [active, "registration_expired", null, null]);
  check(cutoffClose.closed, "cutoff still closes without unanimous early approval");
  await user("owner");
  const fallback = await batch({ minimum: 1 });
  await join(fallback, "a", 1, { earlyPaymentMinimumQuantity: 1 });
  await user("owner");
  const baseClose = await rpc("confirm_early_payment_close", [fallback, preview(await context(fallback)), null, null]);
  check(baseClose.unitPrice === 10000 && baseClose.tierNumber === 1, "below discount threshold uses base price");
  const full = await batch({ policy: "capacity_or_cutoff" });
  await join(full, "a", 40); await user("owner");
  await rpc("configure_early_payment", [full, 40, crypto.randomUUID()]);
  const fullProposal = (await context(full)).proposal;
  await join(full, "c", 60, { earlyPaymentProposalId: fullProposal.id, earlyPaymentProposalRevision: fullProposal.revision });
  check((await q("select status from batches where id=$1", [full]))[0].status === "closed", "original full-capacity policy closes despite pending optional proposal");
  const legacy = await batch({ version: 1 }); await user("a");
  const legacyReg = (await q("insert into registrations(batch_id,umkm_id,quantity,consent_terms) values($1,$2,40,'{}') returning id", [legacy, users.a]))[0].id;
  await user("owner"); const legacyProposal = (await rpc("configure_early_payment", [legacy, 40, crypto.randomUUID()])).proposal;
  await user("a"); await rpc("decide_early_payment", [legacyReg, legacyProposal.id, legacyProposal.revision, "accepted"]);
  await user("owner"); const legacyClose = await rpc("confirm_early_payment_close", [legacy, preview(await context(legacy)), null, null]);
  check(Date.parse(legacyClose.paymentClosesAt)-Date.parse(legacyClose.paymentOpensAt) === 86400000, "legacy participant can explicitly opt into 24-hour manual opening");
  const empty = await batch(); await user("owner");
  await rpc("configure_early_payment", [empty, 40, crypto.randomUUID()]);
  check((await context(empty)).originalMinimumQuantity === 40, "empty published offer configures independent target directly");
  await fail(() => q("update batches set capacity_quantity=null where id=$1", [empty]), "configured target requires bounded capacity");
  const draftId=crypto.randomUUID(); const photo=`https://example.com/storage/v1/object/public/wesup-public/products/${draftId}/a.webp`;
  await q("insert into storage.objects values('wesup-public',$1)", [`products/${draftId}/a.webp`]);
  const now=Date.now(); const payload={title:"Beras",description:"Beras Bandung",category:"Sayur & Buah",unit:"kg",capacityQuantity:100,pickupName:"Gudang",pickupAddress:"Bandung",pickupLatitude:-6.914744,pickupLongitude:107.60981,tiers:[{minimumQuantity:1,pricePerUnit:10000},{minimumQuantity:25,pricePerUnit:8000}],schedule:{openingMode:"immediate",collectionDays:1,pickupStartsAt:(new Date(now+4*86400000).toISOString().slice(0,10)+"T01:00:00Z"),pickupEndsAt:(new Date(now+4*86400000).toISOString().slice(0,10)+"T09:00:00Z")}};
  await q("insert into supplier_offer_drafts(id,supplier_id,revision,payload) values($1,$2,1,$3)",[draftId,users.owner,payload]);
  await fail(() => rpc("publish_supplier_offer",[draftId,1,photo]), "publication requires minimum while partial draft is allowed");
  payload.earlyPaymentMinimumQuantity=20; await q("update supplier_offer_drafts set payload=$1 where id=$2",[payload,draftId]);
  const published=await rpc("publish_supplier_offer",[draftId,1,photo]);
  const publishedBatch=(await q("select early_payment_minimum_quantity,min_quantity from batches where id=$1",[published]))[0];
  check(publishedBatch.early_payment_minimum_quantity===20 && publishedBatch.min_quantity===25,"publication persists independent minimum separately from discount threshold");
  await db.exec("set role authenticated");
  await user("other");
  check((await q("select count(*)::int as n from early_payment_proposals"))[0].n === 0, "proposal RLS hides other supplier data");
  await fail(() => q("insert into early_payment_decisions values($1,$2,'accepted','{}',now())", [proposal.id, a.registrationId]), "direct decision writes are denied");
  await db.exec("reset role");
  console.log(`${checks} PostgreSQL checks passed`);
} finally { await db.close(); }
