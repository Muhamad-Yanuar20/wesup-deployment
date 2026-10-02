import pg from 'pg';
import nextEnv from '@next/env';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {INCIDENT_ID,INCIDENT_START,INCIDENT_END,MAX_INCIDENT_ROWS,INCIDENT_SNAPSHOT,normalizeSnapshot,classifyRecovery} from './order-status-recovery.mjs';

export async function main(args=process.argv.slice(2)) {
 if(args.some(x=>x!=='--apply'&&!x.startsWith('--ids=')&&!x.startsWith('--max-rows=')&&!x.startsWith('--report=')))throw new Error('Unknown option');
 const apply=args.includes('--apply');
 const ids=args.find(x=>x.startsWith('--ids='))?.slice(6).split(',');
 const maximum=Number(args.find(x=>x.startsWith('--max-rows='))?.slice(11));
 if(apply&&(!ids?.length||new Set(ids).size!==ids.length||!Number.isInteger(maximum)||maximum<1||maximum>MAX_INCIDENT_ROWS||ids.length>maximum))throw new Error('Apply requires explicit unique --ids and --max-rows (1..31)');
 const manifest=JSON.parse(await readFile('docs/testing/order-status-integrity/incident-manifest.json','utf8'));
 if(manifest.incidentId!==INCIDENT_ID||manifest.entries.length!==MAX_INCIDENT_ROWS||new Set(manifest.entries.map(x=>x.id)).size!==MAX_INCIDENT_ROWS)throw new Error('Incident manifest mismatch');
 if(ids?.some(id=>!manifest.entries.some(e=>e.id===id)))throw new Error('ID outside incident manifest');
 nextEnv.loadEnvConfig(process.cwd());
 const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
 try {
  await db.connect();await db.query(apply?'begin isolation level serializable':'begin read only');
  await db.query("set local lock_timeout='8s'; set local statement_timeout='12s'");
  if(apply) {
   const guard=await db.query("select 1 from pg_trigger where tgrelid='public.registrations'::regclass and tgname='registration_status_integrity_guard' and tgenabled='O'");
   if(!guard.rowCount)throw new Error('Install integrity migration before recovery');
   await db.query('select id from public.batches where id in (select batch_id from public.registrations where id=any($1::uuid[])) order by id for update',[ids]);
   await db.query('select id from public.registrations where id=any($1::uuid[]) order by id for update',[ids]);
   for(const table of ['payments','escrow_holds','refund_requests','pickup_events'])await db.query(`select id from public.${table} where registration_id=any($1::uuid[]) order by id for update`,[ids]);
   await db.query('select id from public.payment_attempts where payment_id in (select id from public.payments where registration_id=any($1::uuid[])) order by id for update',[ids]);
  }
  const rows=(await db.query(INCIDENT_SNAPSHOT,[INCIDENT_START,INCIDENT_END])).rows;
  if(rows.length!==MAX_INCIDENT_ROWS||rows.some(r=>!manifest.entries.some(e=>e.id===r.id&&e.eventId===r.event_id&&e.previousStatus===r.previous_status)))throw new Error('Live audit does not match manifest');
  const now=(await db.query('select clock_timestamp() as now')).rows[0].now.getTime();
  const report={incidentId:INCIDENT_ID,mode:apply?'apply':'dry-run',checkedAt:new Date(now).toISOString(),entries:rows.map(r=>({...normalizeSnapshot(r),...classifyRecovery(normalizeSnapshot(r),now)})),restored:[]};
  console.log(JSON.stringify({mode:report.mode,entries:report.entries.map(r=>({id:r.id,before:r.status,target:r.targetStatus,classification:r.classification,reason:r.reason}))},null,2));
  if(apply) {
   for(const id of ids) {
    const entry=report.entries.find(e=>e.id===id);
    const existing=await db.query('select state from public.order_status_recoveries where incident_id=$1 and registration_id=$2',[INCIDENT_ID,id]);
    if(existing.rows[0]?.state==='restored'){report.restored.push({id,alreadyRestored:true});continue;}
    if(classifyRecovery(entry,(await db.query('select clock_timestamp() as now')).rows[0].now.getTime()).classification!=='safe_to_restore')throw new Error(`Recovery blocked for ${id}: ${entry.reason}`);
    const requestId=randomUUID();
    await db.query("insert into public.order_status_recoveries(incident_id,registration_id,event_id,target_status,expected_updated_at,request_id,evidence) values($1,$2,$3,$4,$5,$6,$7::jsonb)",[INCIDENT_ID,id,entry.event_id,entry.targetStatus,entry.updated_at_exact,requestId,JSON.stringify({reason:entry.reason,amount:entry.final_amount,quantity:entry.quantity,invoiceStatus:entry.invoice_status,escrowStatus:entry.escrow_status})]);
    await db.query("select set_config('app.operation','incident_recovery',true),set_config('app.recovery_incident',$1,true),set_config('app.request_id',$2,true)",[INCIDENT_ID,requestId]);
    const restored=await db.query("update public.registrations set status=$2::public.registration_status,updated_at=clock_timestamp() where id=$1 and status='cancelled' returning id,status,quantity,final_amount,locked_price_per_unit,cancellation_reason",[id,entry.targetStatus]);
    if(restored.rowCount!==1)throw new Error('Concurrent registration change');
    report.restored.push({...restored.rows[0],before:'cancelled',requestId});
   }
   await db.query('commit');
  } else await db.query('rollback');
  const path=args.find(x=>x.startsWith('--report='))?.slice(9);
  if(path)await writeFile(path,JSON.stringify(report,null,2));
  console.log(JSON.stringify({restored:report.restored,counts:report.entries.reduce((acc,r)=>({...acc,[r.classification]:(acc[r.classification]||0)+1}),{})},null,2));
 } catch(error){await db.query('rollback').catch(()=>{});throw error;}finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error('Recovery stopped:',error.code||error.message);process.exitCode=1;});
