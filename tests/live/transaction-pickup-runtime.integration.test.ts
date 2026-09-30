import { expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";

it.skipIf(!process.env.DATABASE_URL)("generates pickup credentials for the isolated QA buyer on actual Supabase", async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    await db.query("BEGIN");
    const buyer = (await db.query("select id from public.profiles where full_name='QA Wesup umkm' and role='umkm' limit 1")).rows[0];
    const supplier = (await db.query("select id from public.profiles where full_name='QA Wesup supplier' and role='supplier' limit 1")).rows[0];
    expect(buyer, "Requires the isolated QA buyer account").toBeDefined();
    expect(supplier, "Requires the isolated QA supplier account").toBeDefined();
    const batchId = randomUUID(), registrationId = randomUUID();
    // A rollback-only fixture keeps this regression independent of yesterday's
    // pickup window. Production clocks and triggers remain enabled.
    await db.query("insert into public.batches(id,supplier_id,title,description,category,min_quantity,capacity_quantity,unit,status,transaction_policy_version,pickup_name,pickup_address,latitude,longitude) values($1,$2,'QA pickup crypto regression','Rollback-only integration fixture','Sayur & Buah',1,10,'kg','published',1,'Lokasi QA Bandung','Lokasi QA Bandung',-6.914744,107.60981)", [batchId, supplier.id]);
    await db.query("insert into public.batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at) values($1,now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours',now()+interval '26 hours',now()+interval '3 days')", [batchId]);
    await db.query("insert into public.batch_tiers(batch_id,tier_number,min_volume,price_per_unit) values($1,1,1,10000)", [batchId]);
    await db.query("insert into public.registrations(id,batch_id,umkm_id,quantity,status,final_amount,locked_tier_number,locked_price_per_unit,consented_at,consent_latitude,consent_longitude) values($1,$2,$3,1,'paid',10000,1,10000,now(),-6.914744,107.60981)", [registrationId, batchId, buyer.id]);
    await db.query("update public.batch_timeline set registration_opens_at=now()-interval '3 days',registration_closes_at=now()-interval '2 days',payment_opens_at=now()-interval '2 days'+interval '1 second',payment_closes_at=now()-interval '1 day',estimated_ready_at=now()-interval '1 hour' where batch_id=$1", [batchId]);
    await db.query("update public.batches set status='closed',ready_at=now()-interval '2 hours' where id=$1", [batchId]);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [buyer.id]);
    await db.query("SET LOCAL ROLE authenticated");
    const result = await db.query("select * from public.generate_pickup_code($1,null,null)", [registrationId]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pin_code).toMatch(/^\d{4}$/);
  } finally { await db.query("ROLLBACK").catch(() => undefined); await db.end(); }
});
