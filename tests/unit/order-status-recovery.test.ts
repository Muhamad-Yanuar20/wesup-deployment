import {describe,it,expect} from 'vitest';
import {classifyRecovery} from '../../scripts/order-status-recovery.mjs';
const base={id:'a',incident_verified:true,previous_status:'pending_payment',status:'cancelled',unchanged_since_incident:true,cancellation_reason:null,batch_status:'closed',invoice_status:'pending',amount_matches:true,opens_at:'2026-10-02T00:00:00Z',closes_at:'2026-10-03T00:00:00Z',has_attempt:false,has_escrow:false,has_refund:false};
const now=Date.parse('2026-10-02T10:00:00Z');
describe('incident recovery eligibility',()=>{
 it('restores only verified unpaid orders inside effective payment window',()=>expect(classifyRecovery(base,now).classification).toBe('safe_to_restore'));
 it.each([{incident_verified:false},{unchanged_since_incident:false},{amount_matches:false},{closes_at:'2026-10-01T00:00:00Z'}])('does not guess when evidence or deadlines disagree: %j',patch=>expect(classifyRecovery({...base,...patch},now).classification).toBe('manual_review'));
 it('requires reconciliation for any attempt on unpaid invoice',()=>expect(classifyRecovery({...base,has_attempt:true},now).classification).toBe('needs_reconciliation'));
 it('skips the already paid 111 kg order',()=>expect(classifyRecovery({...base,status:'paid'},now).classification).toBe('already_resolved'));
 it('preserves legitimate cancellation',()=>expect(classifyRecovery({...base,batch_status:'takedown',cancellation_reason:'takedown'},now).classification).toBe('legitimate_cancellation'));
 it('paid restoration needs settlement and escrow and future pickup deadline',()=>{
  const paid={...base,previous_status:'paid',invoice_status:'paid',settlement_verified:true,has_escrow:true,escrow_status:'held',escrow_amount_matches:true,pickup_deadline:'2026-10-03T12:00:00Z'};
  expect(classifyRecovery(paid,now).classification).toBe('safe_to_restore');
  expect(classifyRecovery({...paid,settlement_verified:false},now).classification).toBe('needs_reconciliation');
  expect(classifyRecovery({...paid,pickup_deadline:'2026-10-01T12:00:00Z'},now).classification).toBe('manual_review');
 });
 it('pickup and refunds require corresponding evidence',()=>expect(classifyRecovery({...base,previous_status:'picked_up',invoice_status:'paid',settlement_verified:true,has_escrow:true,escrow_amount_matches:true},now).classification).toBe('manual_review'));
});
