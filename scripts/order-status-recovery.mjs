export const INCIDENT_ID='registration-mass-cancel-20261002T074542Z';
export const INCIDENT_START='2026-10-02T07:45:42Z';
export const INCIDENT_END='2026-10-02T07:45:43Z';
export const MAX_INCIDENT_ROWS=31;

export function classifyRecovery(row,now) {
 const result=(classification,reason)=>({classification,reason,targetStatus:row?.previous_status});
 if(!row?.incident_verified) return result('manual_review','incident_evidence_missing');
 if(row.status!=='cancelled')return result('already_resolved','current_status_changed');
 if(['registered','pending_payment'].includes(row.previous_status)&&(row.cancellation_reason||['cancelled','takedown'].includes(row.batch_status)))return result('legitimate_cancellation','explicit_cancellation_or_invalid_batch');
 if(!row.unchanged_since_incident)return result('manual_review','order_changed_since_incident');
 if(row.previous_status==='registered') {
  return row.batch_status==='published'&&Date.parse(row.registration_closes_at)>now&&!row.invoice_status&&!row.has_attempt&&!row.has_escrow&&!row.has_refund
   ?result('safe_to_restore','registration_still_open'):result('manual_review','registration_window_or_evidence_changed');
 }
 if(!row.amount_matches)return result('manual_review','invoice_amount_mismatch');
 if(row.previous_status==='pending_payment') {
  if(!['published','closed'].includes(row.batch_status)||!(Date.parse(row.opens_at)<=now&&now<Date.parse(row.closes_at)))return result('manual_review','payment_window_not_open');
  if(row.has_attempt||row.has_provider_evidence)return result('needs_reconciliation','provider_result_requires_verification');
  if(row.invoice_status!=='pending'||row.has_escrow||row.has_refund)return result('manual_review','financial_state_conflict');
  return result('safe_to_restore','unpaid_invoice_without_provider_attempt');
 }
 if(row.invoice_status!=='paid'||!row.settlement_verified)return result('needs_reconciliation','settlement_not_confirmed');
 if(!row.has_escrow||!row.escrow_amount_matches)return result('manual_review','escrow_amount_or_evidence_missing');
 if(row.previous_status==='paid') {
  if(!['published','closed'].includes(row.batch_status)||row.has_refund||row.has_pickup||row.escrow_status!=='held'||row.release_destination==='umkm'||!(Date.parse(row.pickup_deadline)>now))return result('manual_review','pickup_deadline_or_financial_state_changed');
  return result('safe_to_restore','confirmed_payment_and_held_escrow');
 }
 if(row.previous_status==='picked_up') {
  if(!row.has_pickup||row.has_refund||row.escrow_status!=='held'||!(Date.parse(row.auto_release_at)>now))return result('manual_review','pickup_or_next_deadline_requires_review');
  return result('safe_to_restore','pickup_verified_before_escrow_deadline');
 }
 if(row.previous_status==='no_show'&&row.escrow_status==='forfeited'&&row.release_destination==='supplier'&&!row.has_pickup&&!row.has_refund)return result('safe_to_restore','forfeiture_evidence_matches');
 if(row.previous_status==='refund_pending'&&row.has_refund&&row.refund_amount_matches&&['pending','processing'].includes(row.refund_status)&&row.escrow_status==='frozen'&&row.release_destination==='umkm')return result('safe_to_restore','refund_queue_and_escrow_match');
 return result('manual_review','financial_state_requires_manual_review');
}

// No user identities, checkout credentials, or provider payloads are read here.
export const INCIDENT_SNAPSHOT=`select e.id as event_id,e.registration_id as id,e.from_status as previous_status,e.created_at as incident_at,
 r.status,r.updated_at,r.updated_at::text as updated_at_exact,r.quantity,r.final_amount,r.locked_price_per_unit,r.cancellation_reason,r.batch_id,
 b.status as batch_status,p.id as payment_id,p.status as invoice_status,
 (p.gross_amount=r.final_amount and r.final_amount>0) as amount_matches,
 (r.updated_at=e.created_at) as unchanged_since_incident,true as incident_verified,
 t.registration_closes_at,coalesce(t.effective_payment_opens_at,t.payment_opens_at) as opens_at,
 coalesce(t.effective_payment_closes_at,t.payment_closes_at) as closes_at,
 coalesce(t.pickup_ends_at,t.estimated_ready_at+interval '12 hours') as pickup_deadline,
 exists(select 1 from public.payment_attempts a where a.payment_id=p.id) as has_attempt,
 (p.paid_at is not null or p.midtrans_transaction_id is not null or p.qr_code_url is not null) as has_provider_evidence,
 (p.paid_at is not null and (exists(select 1 from public.payment_attempts a where a.payment_id=p.id and a.status='paid' and a.provider_status in ('settlement','capture'))
  or (p.midtrans_transaction_id is not null and p.webhook_payload->>'transaction_status' in ('settlement','capture')))) as settlement_verified,
 (h.id is not null) as has_escrow,h.status as escrow_status,h.release_destination,h.auto_release_at,
 (h.amount=r.final_amount) as escrow_amount_matches,
 exists(select 1 from public.pickup_events pe where pe.registration_id=r.id) as has_pickup,
 (f.id is not null) as has_refund,f.status as refund_status,(f.amount=r.final_amount) as refund_amount_matches
 from public.registration_status_events e join public.registrations r on r.id=e.registration_id
 join public.batches b on b.id=r.batch_id left join public.batch_timeline t on t.batch_id=b.id
 left join public.payments p on p.registration_id=r.id left join public.escrow_holds h on h.registration_id=r.id
 left join public.refund_requests f on f.registration_id=r.id
 where e.created_at>=$1 and e.created_at<$2 and e.to_status='cancelled'
 and e.from_status<>'cancelled' and e.source='status_update' and e.actor_id is null`;

export function normalizeSnapshot(row) {
 return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Date?value.toISOString():value]));
}
