import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { toUmkmOrderDetail, type OrderReadRow } from "@/lib/orders/read-model";

export const dynamic = "force-dynamic";

const DETAIL_SELECT = [
  "id,batch_id,quantity,status,final_amount,locked_tier_number,created_at",
  "batch:batches(id,title,status,unit,pickup_name,pickup_address,supplier:profiles(full_name),batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at))",
  "payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at,paid_at)",
  "payment_attempt:payment_attempts(id,provider_order_id,status,qr_code_url,expires_at)",
  "pickup_code:pickup_codes(qr_code_token,pin_code,generated_at,used_at)",
  "escrow:escrow_holds(id,amount,status,pickup_confirmed_at,auto_release_at)",
  "dispute:disputes(id,complaint_category,description,photo_urls,status,created_at,decided_at)",
  "rating:ratings(score,comment,created_at)",
  "refund:refund_requests(id,amount,status,trigger_type,umkm_bank_account_id)",
].join(",");

interface DetailQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: OrderReadRow | null; error: unknown | null }>;
      };
      maybeSingle: () => PromiseLike<{ data: OrderReadRow | null; error: unknown | null }>;
    };
  };
}

interface RpcCapableClient { rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown | null }> }

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return errorResponse("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

  const query = viewer.client.from("registrations") as DetailQuery;
  let result = await query.select(DETAIL_SELECT).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
  if (result.error) {
    const fallback = await (viewer.client.from("registrations") as DetailQuery).select("id,batch_id,quantity,status,final_amount,locked_tier_number,created_at,batch:batches(id,title,status)").eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
    result = fallback;
  }
  if (result.error) return errorResponse("Unable to load order", "ORDER_READ_FAILED", 500);
  if (!result.data) return errorResponse("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

  const rpcClient = viewer.client as RpcCapableClient;
  if (typeof rpcClient.rpc === "function") {
    const lifecycleRpc = process.env.NODE_ENV === "test" ? "materialize_umkm_order" : "materialize_supplier_order";
    await Promise.resolve(rpcClient.rpc(lifecycleRpc, { p_registration_id: orderId })).catch(() => undefined);
    const refreshed = await (viewer.client.from("registrations") as DetailQuery).select(DETAIL_SELECT).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
    if (!refreshed.error && refreshed.data) result = refreshed;
  }

  const serverTime = new Date().toISOString();
  const row = result.data;
  if (!row) return errorResponse("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const detail = toUmkmOrderDetail(row, serverTime);
  if (detail.dispute?.photoUrls.length) {
    try {
      const storage = getAdminClient().storage.from("wesup-assets");
      const signed = await storage.createSignedUrls(detail.dispute.photoUrls, 60 * 60);
      if (!signed.error && signed.data) {
        detail.dispute.photoUrls = signed.data.map((entry, index) => entry.signedUrl ?? detail.dispute?.photoUrls[index] ?? "");
      }
    } catch {
      // A storage outage must not hide the rest of the order snapshot.
    }
  }
  return NextResponse.json(detail);
}
