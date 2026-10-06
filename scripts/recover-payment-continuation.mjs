import pg from "pg";
import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export const INCIDENT_ORDER = "14df50d9-d7d4-4a79-87f2-2b29dbc8c96c";
export function recoveryBlockers(row, now) {
  if (!row) return ["order_not_found"];
  const errors = [];
  if (row.id !== INCIDENT_ORDER || Number(row.quantity)!==111 || Number(row.final_amount)!==7770000) errors.push("incident_identity_mismatch");
  if (row.status!=="cancelled" || row.cancellation_reason) errors.push("not_unexplained_cancellation");
  if (row.batch_status!=="closed") errors.push("batch_not_payable");
  if (!(Date.parse(row.opens_at)<=now && now<Date.parse(row.closes_at))) errors.push("payment_window_not_open");
  if (row.invoice_status!=="pending" || Number(row.gross_amount)!==Number(row.final_amount)) errors.push("invoice_not_payable");
  if (row.has_attempt || row.has_provider_evidence || row.has_escrow || row.has_refund) errors.push("financial_reconciliation_required");
  if (!row.premature_audit) errors.push("cancellation_not_verified");
  return errors;
}
const SNAPSHOT = `select r.id,r.batch_id,r.status,r.quantity,r.final_amount,r.locked_price_per_unit,r.cancellation_reason,b.status as batch_status,p.status as invoice_status,p.gross_amount,
 coalesce(t.effective_payment_opens_at,t.payment_opens_at) as opens_at,coalesce(t.effective_payment_closes_at,t.payment_closes_at) as closes_at,
 exists(select 1 from payment_attempts a where a.payment_id=p.id) as has_attempt,
 (p.paid_at is not null or p.midtrans_transaction_id is not null or p.qr_code_url is not null) as has_provider_evidence,
 exists(select 1 from escrow_holds e where e.registration_id=r.id) as has_escrow,
 exists(select 1 from refund_requests f where f.registration_id=r.id) as has_refund,
 exists(select 1 from registration_status_events e where e.registration_id=r.id and e.from_status='pending_payment' and e.to_status='cancelled' and e.actor_id is null and e.source='status_update' and e.created_at>=coalesce(t.effective_payment_opens_at,t.payment_opens_at) and e.created_at<coalesce(t.effective_payment_closes_at,t.payment_closes_at)) as premature_audit
 from registrations r join batches b on b.id=r.batch_id join batch_timeline t on t.batch_id=b.id join payments p on p.registration_id=r.id where r.id=$1`;

export async function main(args=process.argv.slice(2)) {
  if (args.some(arg=>arg!=="--apply")) throw new Error("Usage: node scripts/recover-payment-continuation.mjs [--apply]");
  nextEnv.loadEnvConfig(process.cwd());
  const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  const apply=args.includes("--apply");
  try {
    await db.connect(); await db.query(apply?"BEGIN":"BEGIN READ ONLY");
    await db.query("set local lock_timeout='8s'"); await db.query("set local statement_timeout='12s'");
    const row=(await db.query(SNAPSHOT+(apply?" for update of b,r,p":""),[INCIDENT_ORDER])).rows[0];
    const now=(await db.query("select clock_timestamp() as now")).rows[0].now.getTime();
    const normalized=row?{...row,opens_at:row.opens_at?.toISOString(),closes_at:row.closes_at?.toISOString()}:null;
    const blockers=recoveryBlockers(normalized,now);
    console.log(JSON.stringify({mode:apply?"apply":"dry-run",orderId:INCIDENT_ORDER,status:row?.status,deadline:normalized?.closes_at,eligible:blockers.length===0,blockers}));
    if (row) console.log(JSON.stringify({otherOrders:(await db.query("select id,status,cancellation_reason from registrations where batch_id=$1 and id<>$2",[row.batch_id,INCIDENT_ORDER])).rows,behavior:"report only"}));
    if (!apply || blockers.length) {await db.query("ROLLBACK");if(apply&&blockers.length)process.exitCode=1;return;}
    const installed=await db.query("select 1 from pg_trigger where tgrelid='public.registrations'::regclass and tgname='payment_cancellation_guard' and tgenabled='O'");
    if (!installed.rowCount) throw new Error("Apply payment continuation migration before recovery");
    const requestId=randomUUID();
    await db.query("select set_config('app.operation','payment_continuation_recovery',true),set_config('app.request_id',$1,true)",[requestId]);
    const updated=await db.query("update registrations set status='pending_payment',cancellation_reason=null,updated_at=clock_timestamp() where id=$1 and status='cancelled' returning id,status,quantity,final_amount,locked_price_per_unit",[INCIDENT_ORDER]);
    if(updated.rowCount!==1)throw new Error("Order changed during recovery");
    await db.query("COMMIT");console.log(JSON.stringify({restored:updated.rows[0],requestId}));
  } catch(error) {await db.query("ROLLBACK").catch(()=>{});throw error;} finally {await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error("Recovery stopped:",error.code||error.message);process.exitCode=1;});
