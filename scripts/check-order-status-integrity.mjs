import pg from 'pg';
import nextEnv from '@next/env';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function main(args=process.argv.slice(2)) {
 if(args.some(x=>x!=='--schema-only'&&!x.startsWith('--report=')))throw new Error('Unknown option');
 nextEnv.loadEnvConfig(process.cwd());
 const db=new pg.Client({connectionString:process.env.DATABASE_READONLY_URL||process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
 try {
  await db.connect();await db.query('begin read only');await db.query("set local statement_timeout='12s'");
  const guards=(await db.query("select tgname from pg_trigger where tgrelid='public.registrations'::regclass and tgname in ('registration_status_integrity_guard','payment_cancellation_guard') and tgenabled='O'")).rows.map(x=>x.tgname);
  const privileges=(await db.query("select rolname,has_table_privilege(rolname,'public.registrations','UPDATE,DELETE,TRUNCATE,TRIGGER') as unsafe from pg_roles where rolname in ('anon','authenticated','service_role')")).rows;
  const ready=guards.length===2&&privileges.length===3&&privileges.every(x=>!x.unsafe);
  const anomalies=args.includes('--schema-only')?[]:(await db.query(`select r.id,r.status,p.status as invoice_status,h.status as escrow_status,
   array_remove(array[
    case when r.status='cancelled' and p.status='paid' then 'cancelled_with_paid_invoice' end,
    case when r.status='cancelled' and h.id is not null then 'cancelled_with_escrow' end,
    case when r.status in ('paid','picked_up','completed','no_show','refund_pending') and (p.status is distinct from 'paid' or p.gross_amount is distinct from r.final_amount) then 'invoice_status_or_amount_conflict' end,
    case when r.status='cancelled' and r.cancellation_reason is null and b.status in ('published','closed') and clock_timestamp()<coalesce(t.effective_payment_closes_at,t.payment_closes_at) then 'unexplained_cancellation_before_deadline' end,
    case when r.status='no_show' and h.status is distinct from 'forfeited' then 'no_show_escrow_conflict' end,
    case when r.status='completed' and (h.status is distinct from 'released' or h.release_destination is distinct from 'supplier') then 'completed_escrow_conflict' end,
    case when r.status='refund_pending' and h.status is distinct from 'frozen' then 'refund_escrow_conflict' end
   ],null) as issues
   from public.registrations r join public.batches b on b.id=r.batch_id
   left join public.payments p on p.registration_id=r.id left join public.escrow_holds h on h.registration_id=r.id
   left join public.batch_timeline t on t.batch_id=b.id
   order by r.id`)).rows.filter(x=>x.issues.length);
  await db.query('rollback');
  const report={schemaReady:ready,guards,privileges,anomalies};
  const path=args.find(x=>x.startsWith('--report='))?.slice(9);if(path)await writeFile(path,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  return !ready?1:anomalies.length?2:0;
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().then(code=>{process.exitCode=code;}).catch(error=>{console.error('Integrity check stopped:',error.code||error.message);process.exitCode=1;});
