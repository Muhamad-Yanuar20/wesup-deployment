import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole,toAuthResponse,type AuthClient } from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { normalizePriceTiers } from "@/lib/transactions/schedule";
import { transactionError,type TransactionRpcClient } from "@/lib/transactions/api";
import { validateBusinessPhoto } from "@/lib/supplier-registration/contracts";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 const client=await getServerClient();let owner;try{owner=await requireRole(client as unknown as AuthClient,['supplier']);}catch(e){return toAuthResponse(e);}const {id}=await params;
 if(!isUuid(id))return NextResponse.json({error:'Penawaran tidak ditemukan.'},{status:404});
 try {const existing=await client.from('batches').select('product_photo_url').eq('id',id).eq('supplier_id',owner.userId).maybeSingle();if(existing.error||!existing.data)return NextResponse.json({error:'Penawaran tidak ditemukan.'},{status:404});
 const form=await request.formData();const payload=JSON.parse(String(form.get('payload')??'{}'));payload.tiers=normalizePriceTiers(payload.tiers);let photoUrl=existing.data.product_photo_url;const photo=form.get('productPhoto');
 if(photo instanceof File&&photo.size){const error=await validateBusinessPhoto(photo);if(error)return NextResponse.json({error},{status:400});const path=`products/${id}/${crypto.randomUUID()}.webp`;const uploaded=await client.storage.from('wesup-public').upload(path,photo,{contentType:'image/webp',upsert:false});if(uploaded.error)return transactionError(uploaded.error);photoUrl=client.storage.from('wesup-public').getPublicUrl(path).data.publicUrl;}
 const result=await(client as unknown as TransactionRpcClient).rpc('update_offer_content_v2',{p_batch_id:id,p_payload:payload,p_photo_url:photoUrl});return result.error?transactionError(result.error):NextResponse.json({ok:true,serverTime:new Date().toISOString()});
 }catch(e){return transactionError(e);}
}
