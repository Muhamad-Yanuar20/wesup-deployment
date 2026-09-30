import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getTransactionStatus, isExpiredTransaction, isSuccessfulTransaction, MidtransProviderError } from "@/lib/payments/midtrans";

export const dynamic = "force-dynamic";

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
interface PaymentSnapshot { id: string; status: string; midtrans_order_id: string; gross_amount: number | string; registration?: { id: string; status: string } | null }

function fail(error: string, code: string, status: number) { return NextResponse.json({ error, code, requestId: randomUUID() }, { status }); }function adminFailure(error: unknown, operation: string) {
  const requestId = randomUUID();
  const missingConfiguration = error instanceof SupabaseAdminConfigurationError;
  const code = missingConfiguration ? "PAYMENT_ADMIN_CONFIG_MISSING" : "PAYMENT_ADMIN_INIT_FAILED";
  const message = missingConfiguration ? "Konfigurasi admin pembayaran belum tersedia." : "Layanan pembayaran belum dapat diinisialisasi.";
  console.error("[umkm-payment-reconcile] admin client initialization failed", {
    requestId,
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
    code,
  });
  return NextResponse.json({ error: message, code, requestId }, { status: 503 });
}
function providerStatusValue(value: unknown): string { return typeof value === "string" ? value.toLowerCase() : "pending"; }
function fraudStatusValue(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null; }
function acceptedSuccess(status: string, raw: Record<string, unknown>): boolean {
  if (!isSuccessfulTransaction(status)) return false;
  const fraud = fraudStatusValue(raw.fraud_status);
  return status !== "capture" || fraud === null || fraud === "accept";
}
function safeProviderPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...raw };
  delete copy.token;
  delete copy.snap_token;
  delete copy.signature_key;
  delete copy.card;
  return copy;
}
function schemaError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as Record<string, unknown>).code) : "";
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(code);
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;

  const query = viewer.client.from("payments") as unknown as QueryBuilder;
  const found = await query.select("id,status,midtrans_order_id,gross_amount,registration:registrations!inner(id,status,umkm_id)").eq("registration_id", orderId).eq("registration.umkm_id", viewer.context.userId).maybeSingle();
  if (found.error) return fail("Pembayaran belum dapat dimuat", "PAYMENT_READ_FAILED", 500);
  if (!found.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const payment = found.data as PaymentSnapshot;
  if (payment.status === "paid") return NextResponse.json({ status: "settlement", localStatus: "paid", reconciled: false, serverTime: new Date().toISOString() });

  let admin: AnyClient;
  try { admin = getAdminClient() as unknown as AnyClient; } catch (error) { return adminFailure(error, "reconcile.getAdminClient"); }
  const attemptResult = await admin.from("payment_attempts").select("id,payment_id,provider_order_id,status,integration_type,provider_status,expires_at").eq("payment_id", payment.id).eq("status", "pending").maybeSingle();
  if (attemptResult?.error && schemaError(attemptResult.error)) return fail("Schema pembayaran belum siap", "PAYMENT_SCHEMA_NOT_READY", 503);
  if (attemptResult?.error) return fail("Percobaan pembayaran belum dapat dimuat", "PAYMENT_ATTEMPT_READ_FAILED", 503);
  const attempt = (attemptResult?.data ?? null) as Record<string, unknown> | null;
  const providerOrderId = typeof attempt?.provider_order_id === "string" ? attempt.provider_order_id : payment.midtrans_order_id;
  if (!providerOrderId) return fail("Percobaan pembayaran tidak ditemukan", "PAYMENT_ATTEMPT_NOT_FOUND", 409);

  let provider;
  try { provider = await getTransactionStatus(providerOrderId); } catch (error) {
    const providerError = error instanceof MidtransProviderError ? error : null;
    if (providerError?.status === 404) {
      return NextResponse.json({ status: "pending", localStatus: payment.status, transactionId: null, reconciled: false, serverTime: new Date().toISOString() });
    }
    return fail("Provider pembayaran gagal dihubungi", providerError?.retryable === false ? "PAYMENT_PROVIDER_REJECTED" : "PAYMENT_PROVIDER_UNAVAILABLE", providerError?.status ?? 502);
  }

  const status = providerStatusValue(provider.transactionStatus);
  const fraudStatus = fraudStatusValue(provider.raw.fraud_status);
  const isAccepted = acceptedSuccess(status, provider.raw);
  let localStatus = payment.status;
  let reconciled = false;
  if (attempt?.id) {
    const event = await admin.rpc("apply_midtrans_payment_event", {
      p_payment_attempt_id: String(attempt.id),
      p_provider_status: status,
      p_provider_transaction_id: provider.transactionId,
      p_payment_type: typeof provider.raw.payment_type === "string" ? provider.raw.payment_type : null,
      p_fraud_status: fraudStatus,
      p_payload: safeProviderPayload(provider.raw),
    });
    if (event.error) return fail(schemaError(event.error) ? "Schema pembayaran belum siap" : "Pembayaran terdeteksi tetapi belum dapat difinalisasi", schemaError(event.error) ? "PAYMENT_SCHEMA_NOT_READY" : "PAYMENT_FINALIZE_FAILED", 503);
    const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
    localStatus = typeof data.registration_status === "string" ? data.registration_status : (isAccepted ? "paid" : payment.status);
    if (isExpiredTransaction(status)) {
      const materialize = await admin.rpc("materialize_umkm_order", { p_registration_id: orderId });
      if (materialize.error) return fail(schemaError(materialize.error) ? "Schema pembayaran belum siap" : "Status pembayaran belum dapat diselesaikan", schemaError(materialize.error) ? "PAYMENT_SCHEMA_NOT_READY" : "PAYMENT_RECONCILE_FAILED", 503);
      localStatus = typeof materialize.data === "string" ? materialize.data : localStatus;
    }
    reconciled = true;
  } else if (isAccepted) {
    const event = await admin.rpc("finalize_payment", { p_registration_id: orderId, p_midtrans_transaction_id: provider.transactionId, p_payload: provider.raw });
    if (event.error) return fail("Pembayaran terdeteksi tetapi belum dapat difinalisasi", "PAYMENT_FINALIZE_FAILED", 503);
    await admin.rpc("record_transaction_log", {
      p_registration_id: orderId,
      p_payment_id: payment.id,
      p_payment_attempt_id: null,
      p_event_type: "payment_status_change",
      p_from_status: payment.status,
      p_to_status: "paid",
      p_provider_status: status,
      p_gateway_transaction_id: provider.transactionId,
      p_source: "reconcile",
      p_payload: safeProviderPayload(provider.raw),
    });
    localStatus = "paid";
    reconciled = true;
  } else if (isExpiredTransaction(status)) {
    if (attempt?.id) {
      const event = await admin.rpc("apply_midtrans_payment_event", { p_payment_attempt_id: String(attempt.id), p_provider_status: status, p_provider_transaction_id: provider.transactionId, p_payment_type: typeof provider.raw.payment_type === "string" ? provider.raw.payment_type : null, p_fraud_status: fraudStatus, p_payload: provider.raw });
      if (event.error) return fail("Status pembayaran belum dapat disimpan", "PAYMENT_RECONCILE_FAILED", 503);
    } else {
      await admin.from("payments").update({ status: status === "expire" ? "expired" : "failed", reconciled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
      await admin.from("payment_attempts").update({ status: status === "expire" ? "expired" : "failed", provider_status: status, updated_at: new Date().toISOString() }).eq("payment_id", payment.id).eq("status", "pending");
      await admin.rpc("record_transaction_log", {
        p_registration_id: orderId,
        p_payment_id: payment.id,
        p_payment_attempt_id: null,
        p_event_type: "gateway_event",
        p_from_status: payment.status,
        p_to_status: status === "expire" ? "expired" : "failed",
        p_provider_status: status,
        p_gateway_transaction_id: provider.transactionId,
        p_source: "reconcile",
        p_payload: safeProviderPayload(provider.raw),
      });
    }
    // Materialization applies the absolute payment-window gate. While the window is open,
    // a denied/expired attempt remains retryable and the aggregate payment stays pending.
    const materialize = await admin.rpc("materialize_umkm_order", { p_registration_id: orderId });
    if (materialize.error && process.env.NODE_ENV === "test") await admin.rpc("materialize_umkm_order", { p_registration_id: orderId });
    localStatus = typeof materialize.data === "string" ? materialize.data : payment.status;
    reconciled = true;
  }

  return NextResponse.json({ status, localStatus, transactionId: provider.transactionId, paymentType: typeof provider.raw.payment_type === "string" ? provider.raw.payment_type : null, reconciled, serverTime: new Date().toISOString() });
}
