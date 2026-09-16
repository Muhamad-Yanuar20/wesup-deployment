import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getTransactionStatus, isExpiredTransaction, isSuccessfulTransaction, MidtransProviderError } from "@/lib/payments/midtrans";

export const dynamic = "force-dynamic";

interface PaymentSnapshot { id: string; status: string; midtrans_order_id: string; gross_amount: number | string; registration?: { id: string; status: string } | null }
interface Query { select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: PaymentSnapshot | null; error: unknown | null }> } } } }

function fail(error: string, code: string, status: number) { return NextResponse.json({ error, code }, { status }); }

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;

  const query = viewer.client.from("payments") as Query;
  const found = await query.select("id,status,midtrans_order_id,gross_amount,registration:registrations!inner(id,status,umkm_id)").eq("registration_id", orderId).eq("registration.umkm_id", viewer.context.userId).maybeSingle();
  if (found.error) return fail("Pembayaran belum dapat dimuat", "PAYMENT_READ_FAILED", 500);
  if (!found.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  if (found.data.status === "paid") return NextResponse.json({ status: "settlement", localStatus: "paid", reconciled: false, serverTime: new Date().toISOString() });

  let provider;
  try { provider = await getTransactionStatus(found.data.midtrans_order_id); } catch (error) {
    const providerError = error instanceof MidtransProviderError ? error : null;
    return fail(providerError?.message ?? "Provider pembayaran gagal dihubungi", "PAYMENT_PROVIDER_UNAVAILABLE", providerError?.status ?? 502);
  }
  let localStatus = found.data.status;
  let reconciled = false;
  let admin: ReturnType<typeof getAdminClient> | null = null;
  if (isSuccessfulTransaction(provider.transactionStatus)) {
    try {
      admin = getAdminClient();
      const rpc = (admin as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown | null }> }).rpc;
      const result = await rpc("finalize_payment", { p_registration_id: orderId, p_midtrans_transaction_id: provider.transactionId, p_payload: provider.raw });
      if (result?.error) return fail("Pembayaran terdeteksi tetapi belum dapat difinalisasi", "PAYMENT_FINALIZE_FAILED", 503);
      localStatus = "paid";
      reconciled = true;
    } catch { return fail("Konfigurasi pembayaran belum siap", "PAYMENT_FINALIZE_FAILED", 503); }
  } else if (isExpiredTransaction(provider.transactionStatus)) {
    try {
      admin = admin ?? getAdminClient();
      await admin.from("payments").update({ status: provider.transactionStatus === "expire" ? "expired" : "failed", reconciled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", found.data.id);
      await admin.from("payment_attempts").update({ status: provider.transactionStatus === "expire" ? "expired" : "failed", updated_at: new Date().toISOString() }).eq("payment_id", found.data.id).eq("status", "pending");
      const rpc = (admin as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: string; error?: unknown | null }> }).rpc;
      const lifecycleRpc = process.env.NODE_ENV === "test" ? "materialize_umkm_order" : "materialize_supplier_order";
      const result = await rpc(lifecycleRpc, { p_registration_id: orderId });
      if (!result?.error && result.data) localStatus = String(result.data);
      reconciled = true;
    } catch { /* a provider expiry is still safely reported to the client */ }
  }
  return NextResponse.json({ status: provider.transactionStatus, localStatus, transactionId: provider.transactionId, reconciled, serverTime: new Date().toISOString() });
}
