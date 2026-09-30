import {describe,it,expect} from "vitest";
import {getOfferContext,enrichOffer} from "@/lib/transactions/offer-context";
import type {MarketplaceItem} from '@/lib/marketplace/types';
it.each([{error:{code:'42883'},data:null},{error:null,data:[]},{error:null,data:{}},{error:null,data:null}])('does not invent v2 capabilities when context is unavailable',async result=>{
 expect(await getOfferContext({rpc:async()=>result},'batch')).toBeNull();
 const item={id:'batch'} as MarketplaceItem;
 expect(await enrichOffer({rpc:async()=>result},item)).toBe(item);
});
it('enriches published offers with authoritative context',async()=>{
 const result=await enrichOffer({rpc:async()=>({error:null,data:{transaction_policy_version:2,commercial_locked:false}})},{id:'batch'} as MarketplaceItem);
 expect(result.policyVersion).toBe(2);
});
it('keeps per-order pickup rights from the server instead of assuming the newest proposal was accepted',async()=>{
 const result=await getOfferContext({rpc:async()=>({error:null,data:{transaction_policy_version:2,pickup_actions:[{registration_id:'accepted-old',can_confirm:true},{registration_id:'not-accepted',can_confirm:false}],replacements:[]}})},'batch');
 expect(result?.pickupActions).toEqual([{registrationId:'accepted-old',canConfirm:true},{registrationId:'not-accepted',canConfirm:false}]);
});
describe('offer context',()=>{it('normalizes the authoritative SQL fields without device timezone assumptions',async()=>{const result=await getOfferContext({rpc:async()=>({error:null,data:{transaction_policy_version:2,commercial_locked:true,ready_at:null,capacity_quantity:10,unit:'kg',payment_opens_at:'2026-10-02T01:00:00Z',payment_closes_at:'2026-10-03T01:00:00Z',estimated_ready_at:'2026-10-04T01:00:00Z',pickup_ends_at:'2026-10-04T09:00:00Z',replacements:[]}})},'batch');expect(result).toMatchObject({policyVersion:2,commercialLocked:true,capacityQuantity:10,pickupStartsAt:'2026-10-04T01:00:00Z'});});});
