import { headers } from "next/headers";
import { Layout } from "@/components/layout/Layout";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";
export const dynamic="force-dynamic";
export default async function OrderPage({params}:{params:Promise<{orderId:string}>}) {
 const {orderId}=await params;const h=await headers();const production=process.env.MIDTRANS_IS_PRODUCTION==='true';
 return <Layout><main className="px-4 py-8"><UmkmOrderDetailClient orderId={orderId} mode="overview" snapConfig={{clientKey:process.env.MIDTRANS_CLIENT_KEY??'',scriptUrl:`https://app.${production?'':'sandbox.'}midtrans.com/snap/snap.js`,nonce:h.get('x-nonce')}}/></main></Layout>;
}
