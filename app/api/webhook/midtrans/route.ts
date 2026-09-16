import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyMidtransSignature } from "@/lib/payments/midtrans-signature";
import { isExpiredTransaction, isSuccessfulTransaction } from "@/lib/payments/midtrans";

export const dynamic = "force-dynamic";

interface MidtransPayload { order_id?: unknown; transaction_id?: unknown; transaction_status?: unknown; status_code?: unknown; gross_amount?: unknown; signature_key?: unknown; merchant_id?: unknown; fraud_status?: unknown; }
interface SingleQuery { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: unknown | null }> } }; insert: (row: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: { code?: string; message?: string } | null }>; update: (row: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<{ error?: unknown | null }> } }

function failure(error: string, code: string, status: number) { return NextResponse.json({ error, code }, { status }); }

function isProviderStatusCodeValid(status: string, statusCode: string): boolean {
  const accepted: Record<string, readonly string[]> = {
    pending: ["201"],
    settlement: ["200"],
    capture: ["200"],
    expire: ["407"],
    deny: ["202"],
    cancel: ["202"],
    refund: ["200"],
    partial_refund: ["200"],
    authorize: ["200"],
  };
  return accepted[status]?.includes(statusCode) ?? false;
}

export async function POST(request: Request) {
  let payload: MidtransPayload;
  try { payload = await request.json() as MidtransPayload; } catch { return failure("Payload webhook tidak valid", "INVALID_WEBHOOK", 400); }
  const orderId = typeof payload.order_id === "string" ? payload.order_id : "";
  const statusCode = typeof payload.status_code === "string" || typeof payload.status_code === "number" ? String(payload.status_code) : "";
  const grossAmount = typeof payload.gross_amount === "string" || typeof payload.gross_amount === "number" ? String(payload.gross_amount) : "";
  const signature = typeof payload.signature_key === "string" ? payload.signature_key : "";
  const providerStatus = typeof payload.transaction_status === "string" ? payload.transaction_status.toLowerCase() : "";
  const fraudStatus = typeof payload.fraud_status === "string" ? payload.fraud_status.toLowerCase() : "";
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return failure("Konfigurasi webhook belum siap", "PAYMENT_PROVIDER_UNAVAILABLE", 503);
  if (!orderId || !orderId.startsWith("WESUP-") || !statusCode || !grossAmount || !signature || !verifyMidtransSignature(orderId, statusCode, grossAmount, signature, serverKey)) {
    return failure("Signature webhook tidak valid", "INVALID_WEBHOOK_SIGNATURE", 401);
  }
  if (!["pending", "settlement", "capture", "expire", "deny", "cancel", "refund", "partial_refund", "authorize"].includes(providerStatus) || !/^\d{3}$/.test(statusCode) || !isProviderStatusCodeValid(providerStatus, statusCode)) {
    return failure("Status webhook Midtrans tidak valid", "INVALID_WEBHOOK_STATUS", 400);
  }
  const expectedMerchantId = process.env.MIDTRANS_MERCHANT_ID?.trim();
  if (expectedMerchantId && payload.merchant_id !== expectedMerchantId) {
    return failure("Merchant webhook tidak sesuai", "INVALID_WEBHOOK_MERCHANT", 400);
  }
  if (providerStatus === "capture" && fraudStatus && fraudStatus !== "accept") {
    return failure("Fraud status Midtrans belum diterima", "INVALID_WEBHOOK_FRAUD_STATUS", 400);
  }

  let admin;
  try { admin = getAdminClient() as unknown as { from: (table: string) => SingleQuery; rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: unknown | null }> }; } catch { return failure("Konfigurasi Supabase belum siap", "INFRASTRUCTURE_UNAVAILABLE", 503); }
  const paymentQuery = admin.from("payments");
  const found = await paymentQuery.select("id,registration_id,status,gross_amount").eq("midtrans_order_id", orderId).maybeSingle();
  if (found.error) return failure("Pembayaran belum dapat dimuat", "PAYMENT_READ_FAILED", 503);
  if (!found.data) return NextResponse.json({ ok: true, ignored: true });
  const expectedAmount = Number(found.data.gross_amount);
  if (!Number.isFinite(expectedAmount) || Number(grossAmount) !== expectedAmount) return failure("Nominal webhook tidak sesuai invoice", "WEBHOOK_AMOUNT_MISMATCH", 400);
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const log = await admin.from("payment_webhook_logs").insert({ payment_id: found.data.id, event_type: String(payload.transaction_status ?? "unknown"), payload, payload_hash: payloadHash, status: "received" });
  if (log.error && log.error.code !== "23505") return failure("Webhook belum dapat dicatat", "WEBHOOK_LOG_FAILED", 503);
  if (log.error?.code === "23505") return NextResponse.json({ ok: true, deduplicated: true });

  const currentStatus = String(found.data.status ?? "pending");
  if (currentStatus !== "paid" && isSuccessfulTransaction(providerStatus)) {
    const result = await admin.rpc("finalize_payment", { p_registration_id: String(found.data.registration_id), p_midtrans_transaction_id: typeof payload.transaction_id === "string" ? payload.transaction_id : null, p_payload: payload });
    if (result.error) return failure("Pembayaran belum dapat difinalisasi", "PAYMENT_FINALIZE_FAILED", 503);
  } else if (currentStatus !== "paid" && isExpiredTransaction(providerStatus)) {
    await paymentQuery.update({ status: providerStatus === "expire" ? "expired" : "failed", reconciled_at: new Date().toISOString(), webhook_payload: payload, updated_at: new Date().toISOString() }).eq("id", String(found.data.id));
    // The RPC applies the payment-window gate and idempotent strike/cancel.
    await admin.rpc("materialize_umkm_order", { p_registration_id: String(found.data.registration_id) });
  }
  return NextResponse.json({ ok: true });
}
