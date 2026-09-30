import { describe,it,expect } from "vitest";
import { toUmkmOrderDetail,toUmkmOrderListItem,type OrderReadRow } from "@/lib/orders/read-model";
const timeline={registration_opens_at:'2026-10-01T01:00:00Z',registration_closes_at:'2026-10-02T01:00:00Z',payment_opens_at:'2026-10-02T01:00:00Z',payment_closes_at:'2026-10-03T01:00:00Z',estimated_ready_at:'2026-10-04T01:00:00Z',pickup_ends_at:'2026-10-04T09:00:00Z'};
function row(patch:Partial<OrderReadRow>={}):OrderReadRow{return{id:'order',batch_id:'batch',quantity:3,status:'paid',final_amount:27000,locked_tier_number:2,created_at:'2026-10-01T01:00:00Z',batch:{title:'Beras',transaction_policy_version:2,ready_at:null,unit:'kg',pickup_address:'Bandung',batch_timeline:timeline},...patch};}
describe('shared v2 transaction snapshot',()=>{
 it('keeps paid distinct from actual readiness at the promised opening',()=>{
  const item=toUmkmOrderListItem(row(),'2026-10-04T01:00:00Z');
  expect(item.phase).toBe('supplier_delayed');expect(item.capabilities.canViewPickup).toBe(false);expect(item.capabilities.canChoosePickup).toBe(true);expect(item.timeline.pickupDeadlineAt).toBe(timeline.pickup_ends_at);
 });
 it('does not advance pickup because the supplier confirmed readiness early',()=>{
  const item=toUmkmOrderDetail(row({batch:{...row().batch,ready_at:'2026-10-03T01:00:00Z'}}),'2026-10-03T02:00:00Z');
  expect(item.phase).toBe('paid_waiting_ready');expect(item.capabilities.canViewPickup).toBe(false);
 });
 it('uses the explicitly accepted replacement, preserving its own readiness',()=>{
  const item=toUmkmOrderDetail(row({accepted_pickup_revision:'new',batch:{...row().batch,ready_at:'2026-10-03T01:00:00Z',pickup_replacements:[{id:'new',revision:1,starts_at:'2026-10-05T01:00:00Z',ends_at:'2026-10-05T05:00:00Z',ready_at:null,reason:'Terlambat'}]}}),'2026-10-05T01:00:00Z');
  expect(item.phase).toBe('supplier_delayed');expect(item.timeline.estimatedReadyAt).toBe('2026-10-05T01:00:00Z');expect(item.readyAt).toBeNull();
 });
 it('does not lock a buyer out of an unfinished checkout during the payment window',()=>{
  const item=toUmkmOrderDetail(row({status:'pending_payment',payment:{status:'pending',payment_attempts:[{id:'attempt',status:'pending',payment_type:null}]}}),'2026-10-02T02:00:00Z');
  expect(item.phase).toBe('payment_open');expect(item.capabilities.canPay).toBe(true);
 });
 it('shows provider uncertainty at the deadline without inviting another charge',()=>{
  const input=row({status:'pending_payment',payment:{status:'pending',payment_attempts:[{id:'attempt',status:'pending',payment_type:null}]}});
  const list=toUmkmOrderListItem(input,'2026-10-03T01:00:00Z'),detail=toUmkmOrderDetail(input,'2026-10-03T01:00:00Z');
  expect(list.phase).toBe('payment_verifying');expect(list.presentation).toEqual(detail.presentation);expect(list.capabilities.canPay).toBe(false);
 });
 it('withdraws only before the absolute cutoff',()=>{
  expect(toUmkmOrderDetail(row({status:'registered'}),'2026-10-02T00:59:59Z').capabilities.canWithdraw).toBe(true);
  expect(toUmkmOrderDetail(row({status:'registered'}),'2026-10-02T01:00:00Z').capabilities.canWithdraw).toBe(false);
 });
});
