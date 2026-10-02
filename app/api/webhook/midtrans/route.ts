import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { verifyMidtransSignature } from "@/lib/payments/midtrans-signature";

export const dynamic = "force-dynamic";

interface MidtransPayload {
  order_id?: unknown;
  transaction_id?: unknown;
  transaction_status?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  merchant_id?: unknown;
  fraud_status?: unknown;
  payment_type?: unknown;
  settlement_time?: unknown;
  transaction_time?: unknown;
}

type QueryResult = { data?: unknown | null; error?: unknown | null };
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  maybeSingle: () => PromiseLike<QueryResult>;
  update: (row: Record<string, unknown>) => QueryBuilder;
  insert: (row: Record<string, unknown>) => QueryBuilder;
};

type AnyClient = {
  from: (table: string) => QueryBuilder;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: unknown | null }>;
};

function failure(error: string, code: string, status: number) { return NextResponse.json({ error, code, requestId: randomUUID() }, { status }); }function adminFailure(error: unknown, operation: string) {
  const requestId = randomUUID();
  const missingConfiguration = error instanceof SupabaseAdminConfigurationError;
  const code = missingConfiguration ? "PAYMENT_ADMIN_CONFIG_MISSING" : "PAYMENT_ADMIN_INIT_FAILED";
  const message = missingConfiguration ? "Konfigurasi admin pembayaran belum tersedia." : "Layanan pembayaran belum dapat diinisialisasi.";
  console.error("[midtrans-webhook] admin client initialization failed", {
    requestId,
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
    code,
  });
  return NextResponse.json({ error: message, code, requestId }, { status: 503 });
}
function codeOf(error: unknown): string { return typeof error === "object" && error && "code" in error ? String((error as Record<string, unknown>).code) : ""; }
function isSchemaMissing(error: unknown): boolean { return ["PGRST202", "PGRST205", "42883", "42P01"].includes(codeOf(error)); }
function safePayload(payload: MidtransPayload): Record<string, unknown> {
  const copy = { ...payload } as Record<string, unknown>;
  delete copy.signature_key;
  delete copy.token;
  delete copy.card;
  delete copy.raw_card;
  return copy;
}


function logId(value: unknown): string | null {
  return value && typeof value === "object" && typeof (value as Record<string, unknown>).id === "string"
    ? String((value as Record<string, unknown>).id)
    : null;
}

function logStatus(value: unknown): string | null {
  return value && typeof value === "object" && typeof (value as Record<string, unknown>).status === "string"
    ? String((value as Record<string, unknown>).status)
    : null;
}
function isProviderStatusCodeValid(status: string, statusCode: string): boolean {
  const accepted: Record<string, readonly string[]> = {
    pending: ["201"], settlement: ["200"], capture: ["200"], expire: ["407"], deny: ["202"], cancel: ["202"],
    refund: ["200"], partial_refund: ["200"], chargeback: ["200"], partial_chargeback: ["200"], authorize: ["200"],
  };
  return accepted[status]?.includes(statusCode) ?? false;
}

function deterministicHash(payload: MidtransPayload, orderId: string, status: string, statusCode: string, grossAmount: string): string {
  return createHash("sha256").update([
    orderId,
    typeof payload.transaction_id === "string" ? payload.transaction_id : "",
    status,
    statusCode,
    grossAmount,
    typeof payload.settlement_time === "string" ? payload.settlement_time : typeof payload.transaction_time === "string" ? payload.transaction_time : "",
  ].join("|")).digest("hex");
}

export async function POST(request: Request) {
  let payload: MidtransPayload;
  try { payload = await request.json() as MidtransPayload; } catch { return failure("Payload webhook tidak valid", "INVALID_WEBHOOK", 400); }
  const orderId = typeof payload.order_id === "string" ? payload.order_id : "";
  const statusCode = typeof payload.status_code === "string" || typeof payload.status_code === "number" ? String(payload.status_code) : "";
  const grossAmount = typeof payload.gross_amount === "string" || typeof payload.gross_amount === "number" ? String(payload.gross_amount) : "";
  const signature = typeof payload.signature_key === "string" ? payload.signature_key : "";
  const providerStatus = typeof payload.transaction_status === "string" ? payload.transaction_status.toLowerCase() : "";
  const fraudStatus = typeof payload.fraud_status === "string" && payload.fraud_status.length > 0 ? payload.fraud_status.toLowerCase() : null;
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return failure("Konfigurasi webhook belum siap", "PAYMENT_PROVIDER_UNAVAILABLE", 503);
  if (!orderId || !orderId.startsWith("WESUP-") || !statusCode || !grossAmount || !signature || !verifyMidtransSignature(orderId, statusCode, grossAmount, signature, serverKey)) return failure("Signature webhook tidak valid", "INVALID_WEBHOOK_SIGNATURE", 401);
  if (!Object.hasOwn({ pending: true, settlement: true, capture: true, expire: true, deny: true, cancel: true, refund: true, partial_refund: true, chargeback: true, partial_chargeback: true, authorize: true }, providerStatus) || !/^\d{3}$/.test(statusCode) || !isProviderStatusCodeValid(providerStatus, statusCode)) return failure("Status webhook Midtrans tidak valid", "INVALID_WEBHOOK_STATUS", 400);
  const expectedMerchantId = process.env.MIDTRANS_MERCHANT_ID?.trim();
  if (expectedMerchantId && payload.merchant_id !== expectedMerchantId) return failure("Merchant webhook tidak sesuai", "INVALID_WEBHOOK_MERCHANT", 400);

  let admin: AnyClient;
  try { admin = getAdminClient() as unknown as AnyClient; } catch (error) { return adminFailure(error, "webhook.getAdminClient"); }

  const attemptLookup = await admin.from("payment_attempts").select("id,payment_id,provider_order_id,status,payment:payments(id,registration_id,gross_amount,status)").eq("provider_order_id", orderId).maybeSingle();
  if (attemptLookup?.error && !isSchemaMissing(attemptLookup.error)) return failure("Percobaan pembayaran belum dapat dimuat", "PAYMENT_READ_FAILED", 503);
  const attempt = attemptLookup?.data && !attemptLookup.error ? attemptLookup.data as Record<string, unknown> : null;
  let payment = attempt ? (Array.isArray(attempt.payment) ? attempt.payment[0] : attempt.payment) as Record<string, unknown> | null : null;
  if (!payment || typeof payment !== "object") {
    const legacy = await admin.from("payments").select("id,registration_id,status,gross_amount").eq("midtrans_order_id", orderId).maybeSingle();
    if (legacy.error && !isSchemaMissing(legacy.error)) return failure("Pembayaran belum dapat dimuat", "PAYMENT_READ_FAILED", 503);
    payment = legacy.data as Record<string, unknown> | null;
  }
  if (!payment) return NextResponse.json({ ok: true, ignored: true });
  const expectedAmount = Number(payment.gross_amount);
  if (!Number.isFinite(expectedAmount) || Number(grossAmount) !== expectedAmount) return failure("Nominal webhook tidak sesuai invoice", "WEBHOOK_AMOUNT_MISMATCH", 400);

  const payloadHash = deterministicHash(payload, orderId, providerStatus, statusCode, grossAmount);
  const redactedPayload = safePayload(payload);
  const log = await admin.from("payment_webhook_logs").insert({ payment_id: String(payment.id), event_type: providerStatus, payload: redactedPayload, payload_hash: payloadHash, status: "received" });
  let webhookLogId = logId(log?.data);
  const duplicateLog = log?.error && codeOf(log.error) === "23505";
  if (log?.error && !duplicateLog) return failure("Webhook belum dapat dicatat", "WEBHOOK_LOG_FAILED", 503);
  if (duplicateLog || !webhookLogId) {
    const existingLog = await admin.from("payment_webhook_logs").select("id,status").eq("payload_hash", payloadHash).maybeSingle();
    if (existingLog?.error) return failure("Status webhook belum dapat diverifikasi", "WEBHOOK_LOG_FAILED", 503);
    if (duplicateLog && logStatus(existingLog?.data) === "processed") return NextResponse.json({ ok: true, deduplicated: true });
    webhookLogId = logId(existingLog?.data) ?? webhookLogId;
  }
  const markLog = async (status: "processed" | "failed", errorMessage?: string) => {
    if (!webhookLogId) return;
    await admin.from("payment_webhook_logs").update({ status, ...(errorMessage ? { error_message: errorMessage } : { error_message: null }) }).eq("id", webhookLogId);
  };
  if (attempt?.id) {
    const result = await admin.rpc("apply_midtrans_payment_event", {
      p_payment_attempt_id: String(attempt.id),
      p_provider_status: providerStatus,
      p_provider_transaction_id: typeof payload.transaction_id === "string" ? payload.transaction_id : null,
      p_payment_type: typeof payload.payment_type === "string" ? payload.payment_type : null,
      p_fraud_status: fraudStatus,
      p_payload: {...redactedPayload,_wesup_audit:{source:"payment_webhook",requestId:randomUUID()}},
    });
    if (result.error) {
      await markLog("failed", codeOf(result.error) || "PAYMENT_FINALIZE_FAILED");
      return failure(isSchemaMissing(result.error) ? "Schema pembayaran belum siap" : "Pembayaran belum dapat difinalisasi", isSchemaMissing(result.error) ? "PAYMENT_SCHEMA_NOT_READY" : "PAYMENT_FINALIZE_FAILED", 503);
    }
    if (["expire", "deny", "cancel"].includes(providerStatus)) await admin.rpc("materialize_umkm_order", { p_registration_id: String(payment.registration_id) });
    await markLog("processed");
    return NextResponse.json({ ok: true, processed: true });
  }

  if (["settlement", "capture"].includes(providerStatus) && (providerStatus !== "capture" || !fraudStatus || fraudStatus === "accept")) {
    const result = await admin.rpc("finalize_payment", { p_registration_id: String(payment.registration_id), p_midtrans_transaction_id: typeof payload.transaction_id === "string" ? payload.transaction_id : null, p_payload: {...redactedPayload,_wesup_audit:{source:"payment_webhook",requestId:randomUUID()}} });
    if (result.error) {
      await markLog("failed", codeOf(result.error) || "PAYMENT_FINALIZE_FAILED");
      return failure("Pembayaran belum dapat difinalisasi", "PAYMENT_FINALIZE_FAILED", 503);
    }
    await admin.rpc("record_transaction_log", {
      p_registration_id: String(payment.registration_id),
      p_payment_id: String(payment.id),
      p_payment_attempt_id: null,
      p_event_type: "payment_status_change",
      p_from_status: "pending",
      p_to_status: "paid",
      p_provider_status: providerStatus,
      p_gateway_transaction_id: typeof payload.transaction_id === "string" ? payload.transaction_id : null,
      p_source: "webhook",
      p_payload: redactedPayload,
    });
  } else if (["expire", "deny", "cancel"].includes(providerStatus)) {
    await admin.from("payments").update({ status: providerStatus === "expire" ? "expired" : "failed", reconciled_at: new Date().toISOString(), webhook_payload: redactedPayload, updated_at: new Date().toISOString() }).eq("id", String(payment.id)).eq("status", "pending");
    await admin.rpc("record_transaction_log", {
      p_registration_id: String(payment.registration_id),
      p_payment_id: String(payment.id),
      p_payment_attempt_id: null,
      p_event_type: "gateway_event",
      p_from_status: String(payment.status),
      p_to_status: providerStatus === "expire" ? "expired" : "failed",
      p_provider_status: providerStatus,
      p_gateway_transaction_id: typeof payload.transaction_id === "string" ? payload.transaction_id : null,
      p_source: "webhook",
      p_payload: redactedPayload,
    });
    await admin.rpc("materialize_umkm_order", { p_registration_id: String(payment.registration_id) });
  }
  await markLog("processed");
  return NextResponse.json({ ok: true, processed: true });
}
