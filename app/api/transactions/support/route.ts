import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { transactionError, type TransactionRpcClient } from "@/lib/transactions/api";
export async function POST(request:Request) {
 const client=await getServerClient();const viewer=await getCurrentUser(client as unknown as AuthClient);
 if(!viewer)return NextResponse.json({error:"Masuk terlebih dahulu."},{status:401});
 try { const body=await request.json();if(typeof body.message!=="string"||body.message.trim().length<10||body.message.length>2000||(!(isUuid(body.orderId??"")||isUuid(body.batchId??""))))return NextResponse.json({error:"Jelaskan kendala dengan 10–2000 karakter."},{status:400});
 const result=await (client as unknown as TransactionRpcClient).rpc("request_transaction_support",{p_registration_id:body.orderId??null,p_batch_id:body.batchId??null,p_message:body.message.trim()});if(result.error)return transactionError(result.error);return NextResponse.json({id:result.data});}catch(e){return transactionError(e);}
}
