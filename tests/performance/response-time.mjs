import { createClient } from '@supabase/supabase-js';
import { request } from '@playwright/test';
import { loadEnv } from 'vite';
import { Pool } from 'pg';
import { writeFile } from 'node:fs/promises';
const env={...loadEnv('',process.cwd(),''),...process.env};
const label=process.argv[2]; const bases=process.argv.slice(3);
if(!label||!bases.length) throw new Error('Usage: node tests/performance/response-time.mjs LABEL URL...');
const pool=new Pool({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:1});
const users=[]; const batchId=crypto.randomUUID(); const results=[]; const apis=[];
try {
 for(const role of ['supplier','umkm']) {
  const email=`perf-${crypto.randomUUID()}@example.com`,password=`Perf-${crypto.randomUUID()}`;
  const auth=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.signUp({email,password});
  if(data.user)users.push({id:data.user.id,email,password,role});
  if(error||!data.session)throw new Error('Disposable auth fixture unavailable');
  await pool.query("update profiles set role=$1,status='active' where id=$2",[role,data.user.id]);
  if(role==='supplier')await pool.query("insert into supplier_profiles(user_id,business_name,address,latitude,longitude,ktp_photo_url,nik,verification_status) values($1,'QA response time','Bandung',-6.914744,107.60981,'https://example.com/qa.webp',$2,'approved')",[data.user.id,`perf-${data.user.id}`]);
 }
 await pool.query("insert into batches(id,supplier_id,title,category,min_quantity,pickup_name,pickup_address,latitude,longitude,status,transaction_policy_version,capacity_quantity,unit) values($1,$2,'QA response time private draft','Sayur & Buah',1,'Gudang QA','Bandung',-6.914744,107.60981,'draft',2,100,'kg')",[batchId,users[0].id]);
 await pool.query("insert into batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at,pickup_ends_at) values($1,now()-interval '1 hour',now()+interval '1 day',now()+interval '1 day 1 second',now()+interval '2 days 1 second',now()+interval '4 days',now()+interval '4 days 8 hours')",[batchId]);
 await pool.query("insert into batch_tiers(batch_id,tier_number,min_volume,price_per_unit) values($1,1,1,10000)",[batchId]);
 for(const base of bases) {
  const clients={};
  for(const user of users){const api=await request.newContext({baseURL:base,timeout:45000});apis.push(api);const login=await api.post('/api/auth/login',{data:{email:user.email,password:user.password,role:user.role}});if(login.status()!==200)throw new Error(`Fixture login returned ${login.status()}`);clients[user.role]=api;}
  const routes=[['session','supplier','/api/auth/session'],['dashboard','umkm','/api/umkm/dashboard'],['marketplace','umkm','/api/marketplace/search?q=&radius=10&page=1&limit=12'],['transactions','supplier',`/api/suppliers/batches/${batchId}/transactions`],['proxy_page','supplier','/supplier/pesanan']];
  for(const [name,role,path]of routes.filter(route=>!process.env.PERF_ONLY||route[0]===process.env.PERF_ONLY)){const samples=[];const proxySamples=[];let serverTiming='';let itemCount;
   const warm=await clients[role].get(path);if(warm.status()!==200)throw new Error(`Warm ${name} returned ${warm.status()}`);
   for(let i=0;i<20;i++){const start=performance.now();const r=await clients[role].get(path);await r.body();samples.push(Math.round(performance.now()-start));if(r.status()!==200)throw new Error(`${name} returned ${r.status()}`);serverTiming=r.headers()['server-timing']??serverTiming;const proxyMatch=serverTiming.match(/proxy_auth;dur=([0-9.]+)/);if(proxyMatch)proxySamples.push(Number(proxyMatch[1]));if(name==='marketplace')itemCount=(await r.json()).items.length;}
   const sorted=[...samples].sort((a,b)=>a-b);const row={label,base,name,samples,p50:sorted[9],p95:sorted[18],max:sorted[19],serverTiming,...(proxySamples.length?{proxyAuthP95:[...proxySamples].sort((a,b)=>a-b)[18],proxyAuthSamples:proxySamples}:{}),...(itemCount!==undefined?{itemCount}:{})};results.push(row);console.log(JSON.stringify(row));
   await writeFile(`docs/testing/response-time/${label}.json`,JSON.stringify(results,null,2));
  }
 }
} finally {
 for(const api of apis)await api.dispose();
 await pool.query('delete from batches where id=$1',[batchId]);
 for(const user of users)await pool.query('delete from auth.users where id=$1',[user.id]);
 await pool.end();
}
