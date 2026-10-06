import { withinReadBudget } from "@/lib/performance/read-budget";
import type { EarlyPaymentContext } from "./early-payment";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import type { TransactionRpcClient } from "./api";
export interface OfferContext { earlyPayment?: EarlyPaymentContext; pickupActions?:Array<{registrationId:string;canConfirm:boolean}>; paymentOpeningPolicy?:string;registrationClosesAt?:string;closeReason?:string|null;policyVersion:number;commercialLocked:boolean;readyAt:string|null;capacityQuantity:number|null;unit:string;paymentOpensAt:string;paymentClosesAt:string;pickupStartsAt:string;pickupEndsAt:string|null; replacements:Array<{id:string;revision:number;starts_at:string;ends_at:string;ready_at:string|null;reason:string}> }
export async function getOfferContext(client:TransactionRpcClient,batchId:string):Promise<OfferContext|null> {
 const result=await withinReadBudget(client.rpc("get_offer_context",{p_batch_id:batchId}));
 if(result.error||!result.data||Array.isArray(result.data)||typeof result.data!=='object')return null;
 const data=result.data as Record<string,unknown>;
 if(typeof data.transaction_policy_version!=='number')return null;
 return {earlyPayment:data.early_payment as EarlyPaymentContext | undefined,pickupActions:Array.isArray(data.pickup_actions)?data.pickup_actions.map((row:Record<string,unknown>)=>({registrationId:String(row.registration_id),canConfirm:Boolean(row.can_confirm)})):[],paymentOpeningPolicy:String(data.payment_opening_policy??"fixed_cutoff"),registrationClosesAt:typeof data.registration_closes_at==="string"?data.registration_closes_at:undefined,closeReason:data.close_reason as string|null,policyVersion:data.transaction_policy_version,commercialLocked:Boolean(data.commercial_locked),readyAt:data.ready_at as string|null,capacityQuantity:data.capacity_quantity as number|null,unit:String(data.unit??'pcs'),paymentOpensAt:String(data.payment_opens_at),paymentClosesAt:String(data.payment_closes_at),pickupStartsAt:String(data.estimated_ready_at),pickupEndsAt:data.pickup_ends_at as string|null,replacements:Array.isArray(data.replacements)?data.replacements:[]};
}
export async function enrichOffer(client:TransactionRpcClient,item:MarketplaceItem):Promise<MarketplaceItem> {
 const context=await getOfferContext(client,item.id);return context?{...item,...context}:item;
}
