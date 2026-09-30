import { expect, it } from "vitest";
import pg from "pg";

it.skipIf(!process.env.DATABASE_URL)("generates pickup credentials for the isolated QA buyer on actual Supabase", async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const fixture = (await db.query("select r.id,r.umkm_id from public.registrations r join public.batches b on b.id=r.batch_id join public.profiles p on p.id=r.umkm_id where b.title='QA Wesup pickup' and p.full_name='QA Wesup umkm' and r.status='paid' limit 1")).rows[0];
    expect(fixture, "Requires the isolated QA pickup fixture").toBeDefined();
    await db.query("BEGIN");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [fixture.umkm_id]);
    await db.query("SET LOCAL ROLE authenticated");
    const result = await db.query("select * from public.generate_pickup_code($1,null,null)", [fixture.id]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pin_code).toMatch(/^\d{4}$/);
  } finally { await db.query("ROLLBACK").catch(() => undefined); await db.end(); }
});
