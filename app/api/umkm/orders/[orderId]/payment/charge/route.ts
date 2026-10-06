import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { evaluatePaymentWindow, type BatchTimeline } from "@/lib/orders/time-gatekeeper";
import { acquirePaymentLock, releasePaymentLock } from "@/lib/payments/order-lock";
import { createSnapTransaction, MidtransProviderError } from "@/lib/payments/midtrans";
import { derivePaymentProgress } from "@/lib/payments/progress";

export const dynamic = "force-dynamic";

interface RegistrationSnapshot {
  id: string;
  status: string;
  quantity: number | string;
  final_amount: number | string | null;
  locked_price_per_unit?: number | string | null;
  batch?: { title?: string | null; unit?: string | null; batch_timeline?: BatchTimeline | BatchTimeline[] | null } | null;
  payment?: Record<string, unknown> | Record<string, unknown>[] | null;
}

type QueryResult = { data?: unknown | null; error?: unknown | null };
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  maybeSingle: () => PromiseLike<QueryResult>;
  order: (column: string, options: {ascending: boolean}) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  update: (row: Record<string, unknown>) => QueryBuilder;
  insert: (row: Record<string, unknown>) => QueryBuilder;
};

type AnyClient = {
  from: (table: string) => QueryBuilder;
  rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: unknown | null }>;
};

const REGISTRATION_SELECT = "id,status,quantity,final_amount,locked_price_per_unit,batch:batches(title,unit,batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at)),payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at,reconciled_at)";

function requestId(): string { return randomUUID(); }function adminFailure(error: unknown, operation: string, requestIdValue: string) {
  const missingConfiguration = error instanceof SupabaseAdminConfigurationError;
  const code = missingConfiguration ? "PAYMENT_ADMIN_CONFIG_MISSING" : "PAYMENT_ADMIN_INIT_FAILED";
  const message = missingConfiguration ? "Konfigurasi admin pembayaran belum tersedia." : "Layanan pembayaran belum dapat diinisialisasi.";
  console.error("[umkm-payment] admin client initialization failed", {
    requestId: requestIdValue,
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
    code,
  });
  return NextResponse.json({ error: message, code, requestId: requestIdValue }, { status: 503 });
}

function fail(error: string, code: string, status: number, details?: Record<string, unknown>, headers?: HeadersInit) {
  return NextResponse.json({ error, code, ...(details ? { details } : {}), requestId: requestId() }, { status, headers });
}

function firstObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function timelineOf(snapshot: RegistrationSnapshot): BatchTimeline | null {
  const raw = Array.isArray(snapshot.batch?.batch_timeline) ? snapshot.batch?.batch_timeline[0] : snapshot.batch?.batch_timeline;
  return raw && typeof raw === "object" ? raw : null;
}

function stringValue(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }

function attemptResponse(attempt: Record<string, unknown>, session: Record<string, unknown> | null, serverTime: string, snapshot: RegistrationSnapshot, status = 200) {
  const checkoutMode = attempt.integration_type === "snap" ? "snap" : "core_qris";
  const timeline = timelineOf(snapshot);
  const payment = firstObject(snapshot.payment);
  const progress = derivePaymentProgress({status:snapshot.status,invoiceStatus:payment?.status,attempt,now:serverTime,opensAt:timeline?.effective_payment_opens_at ?? timeline?.payment_opens_at ?? null,closesAt:timeline?.effective_payment_closes_at ?? timeline?.payment_closes_at ?? null,lastCheckedAt:stringValue(payment?.reconciled_at)});
  return NextResponse.json({
    attempt: {
      id: attempt.id,
      providerOrderId: attempt.provider_order_id,
      status: attempt.status,
      checkoutMode,
      snapToken: checkoutMode === "snap" ? stringValue(session?.snap_token) : null,
      redirectUrl: checkoutMode === "snap" ? stringValue(session?.redirect_url) : null,
      qrCodeUrl: checkoutMode === "core_qris" ? stringValue(attempt.qr_code_url) : null,
      expiresAt: stringValue(session?.expires_at ?? attempt.expires_at),
      providerStatus: stringValue(attempt.provider_status),
      paymentMethod: stringValue(attempt.payment_type),
    },
    serverTime,
    paymentProgress:progress,lastCheckedAt:progress.lastCheckedAt,canOpenCheckout:progress.canOpenCheckout,canCheckStatus:progress.canCheckStatus,blockedReason:progress.blockedReason,
    lockedUnitPrice:snapshot.locked_price_per_unit == null ? Number(snapshot.final_amount ?? payment?.gross_amount)/Number(snapshot.quantity) : Number(snapshot.locked_price_per_unit),
  },{status});
}

function providerCode(error: unknown): { code: string; status: number; message: string } {
  if (error instanceof MidtransProviderError) {
    return {
      code: error.status === 403 ? "PAYMENT_CHECKOUT_CUTOFF" : error.retryable ? "PAYMENT_PROVIDER_UNAVAILABLE" : "PAYMENT_PROVIDER_REJECTED",
      status: error.status,
      message: error.status === 403 ? "Checkout tidak dapat dibuat karena jendela pembayaran hampir berakhir." : error.message,
    };
  }
  return { code: "PAYMENT_PROVIDER_UNAVAILABLE", status: 502, message: "Provider pembayaran gagal dihubungi." };
}

function safeProviderPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...raw };
  delete copy.token;
  delete copy.snap_token;
  delete copy.signature_key;
  return copy;
}

function providerOrderId(registrationId: string): string {
  const suffix = `${Date.now().toString(36)}${randomUUID().replaceAll("-", "").slice(0, 4)}`.slice(-10);
  return `WESUP-${registrationId.replaceAll("-", "")}-${suffix}`.slice(0, 50);
}

async function runMaterialization(client: AnyClient, registrationId: string): Promise<unknown | null> {
  if (typeof client.rpc !== "function") return null;
  const rpcName = "materialize_supplier_order";
  const result = await client.rpc(rpcName, { p_registration_id: registrationId });
  return result?.error ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const requestIdValue = requestId();
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;

  let lock: { acquired: boolean; token: string };
  try { lock = await acquirePaymentLock(orderId); } catch { return fail("Layanan pembayaran sedang tidak tersedia", "INFRASTRUCTURE_UNAVAILABLE", 503); }
  if (!lock.acquired) return fail("Permintaan pembayaran sedang diproses", "PAYMENT_IN_PROGRESS", 409);

  try {
    const userClient = viewer.client as unknown as AnyClient;
    const query = userClient.from("registrations");
    let snapshotResult = await query.select(REGISTRATION_SELECT).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
    if (snapshotResult.error) return fail("Pesanan belum dapat dimuat", "ORDER_READ_FAILED", 500);
    if (!snapshotResult.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

    const materializationError = await runMaterialization(userClient, orderId).catch((error) => error);
    if (materializationError) {
      console.error("[umkm-payment] materialize failed", { operation: "materialize_supplier_order", code: typeof materializationError === "object" && materializationError && "code" in materializationError ? String((materializationError as Record<string, unknown>).code) : "unknown" });
      return fail("Status pesanan belum siap untuk pembayaran", "PAYMENT_LIFECYCLE_UNAVAILABLE", 503);
    }
    snapshotResult = await query.select(REGISTRATION_SELECT).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
    if (snapshotResult.error || !snapshotResult.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

    const snapshot = snapshotResult.data as RegistrationSnapshot;
    const timeline = timelineOf(snapshot);
    if (!timeline) return fail("Jadwal pembayaran belum tersedia", "PAYMENT_WINDOW_UNAVAILABLE", 503);
    const serverNow = new Date();
    const serverTime = serverNow.toISOString();
    const gate = evaluatePaymentWindow(timeline, serverTime);
    if (!gate.allowed) return fail(gate.state === "waiting" ? "Jendela pembayaran belum dibuka" : "Jendela pembayaran sudah ditutup", "PAYMENT_WINDOW_CLOSED", 403);
    if (snapshot.status !== "pending_payment" && snapshot.status !== "registered") return fail("Pesanan tidak berada pada status pembayaran", "ORDER_STATE_CONFLICT", 409);

    const payment = firstObject(snapshot.payment);
    if (payment && ["paid", "refunded"].includes(String(payment.status))) return fail("Pembayaran sudah tercatat. Periksa status pesanan sebelum melanjutkan.", "PAYMENT_ALREADY_RECORDED", 409);
    if (payment && payment.status !== "pending") return fail("Periksa status pembayaran sebelumnya sebelum membuat checkout baru.", "PAYMENT_RECONCILIATION_REQUIRED", 409);
    const grossAmount = Number(snapshot.final_amount ?? payment?.gross_amount);
    const quantity = Number(snapshot.quantity);
    if (!Number.isSafeInteger(grossAmount) || grossAmount <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0 || grossAmount % quantity !== 0) return fail("Harga final belum terkunci", "PRICE_NOT_LOCKED", 409);

    let admin: AnyClient;
    try { admin = getAdminClient() as unknown as AnyClient; } catch (error) { return adminFailure(error, "charge.getAdminClient", requestIdValue); }
    let paymentRow = payment;
    if (!paymentRow) {
      const paymentId = randomUUID();
      const paymentInsert = await admin.from("payments").insert({ id: paymentId, registration_id: orderId, midtrans_order_id: `WESUP-${orderId.replaceAll("-", "")}`, gross_amount: grossAmount, status: "pending" });
      if (paymentInsert?.error) return fail("Invoice pembayaran belum dapat dibuat", "PAYMENT_INVOICE_FAILED", 503);
      const refreshed = await query.select(REGISTRATION_SELECT).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
      paymentRow = firstObject((refreshed.data as RegistrationSnapshot | null)?.payment);
    }
    if (!paymentRow?.id) return fail("Invoice pembayaran tidak ditemukan", "PAYMENT_INVOICE_FAILED", 503);

    const attemptResult = await admin.from("payment_attempts").select("id,provider_order_id,status,integration_type,provider_status,provider_checked_at,payment_type,qr_code_url,expires_at,created_at,payment_checkout_sessions(snap_token,redirect_url,expires_at,cancelled_at)").eq("payment_id", String(paymentRow.id)).order("created_at", {ascending:false}).limit(1).maybeSingle();
    if (attemptResult.error) return fail("Percobaan pembayaran sebelumnya belum dapat dimuat. Coba periksa lagi sebelum membayar.", "PAYMENT_ATTEMPT_READ_FAILED", 503);
    const active = attemptResult.data as Record<string, unknown> | null;
    const activeSession = firstObject(active?.payment_checkout_sessions ?? active?.payment_checkout_session);
    const activeExpires = Date.parse(String(activeSession?.expires_at ?? active?.expires_at ?? ""));
    const unresolved = active && ["pending", "creating"].includes(String(active.status));
    const resumable = unresolved || (active?.integration_type === "snap" && active.provider_status === "deny");
    if (unresolved && (activeSession?.cancelled_at || (Number.isFinite(activeExpires) && activeExpires <= Date.now()))) {
      return fail("Periksa status tagihan sebelumnya sebelum membuat pembayaran baru.", "PAYMENT_IN_PROGRESS", 409);
    }
    if (active && resumable && (!Number.isFinite(activeExpires) || activeExpires > Date.now()) && (!activeSession?.cancelled_at)) {
      const integration = active.integration_type === "snap" ? "snap" : "core_qris";
      if (integration === "core_qris" || activeSession?.snap_token) return attemptResponse(active, activeSession, serverTime,snapshot);
      const createdAt = Date.parse(String(active.created_at ?? ""));
      if (!Number.isFinite(createdAt) || Date.now() - createdAt < 2 * 60 * 1000) return fail("Permintaan checkout sedang diproses", "PAYMENT_IN_PROGRESS", 409);
      return fail("Hasil pembuatan tagihan belum pasti. Periksa status atau minta bantuan Admin.", "PAYMENT_IN_PROGRESS", 409);
    }

    const closesAt = timeline.effective_payment_closes_at ?? timeline.payment_closes_at;
    const closesMs = Date.parse(closesAt);
    if (!Number.isFinite(closesMs) || closesMs - Date.now() < 5 * 60 * 1000) return fail("Checkout tidak dapat dibuat pada lima menit terakhir jendela pembayaran", "PAYMENT_CHECKOUT_CUTOFF", 403);
    const attemptId = randomUUID();
    const localProviderOrderId = providerOrderId(orderId);
    const idempotencyKey = `wesup-snap-${attemptId}`;
    const attemptInsert = await admin.from("payment_attempts").insert({ id: attemptId, payment_id: String(paymentRow.id), provider_order_id: localProviderOrderId, status: "pending", integration_type: "snap", provider_status: "creating", qr_code_url: null, expires_at: closesAt, idempotency_key: idempotencyKey, provider_payload: {} });
    if (attemptInsert?.error) return fail("Percobaan pembayaran belum dapat disimpan", "PAYMENT_ATTEMPT_FAILED", 503);

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
    let checkout;
    try {
      checkout = await createSnapTransaction({ orderId: localProviderOrderId, grossAmount, itemName: String(snapshot.batch?.title ?? "Pesanan Wesup"), itemQuantity: quantity, itemUnitPrice: grossAmount / quantity, expiresAt: closesAt, finishUrl: `${siteUrl}/pesanan/${orderId}/bayar`, idempotencyKey }, process.env);
    } catch (error) {
      const mapped = providerCode(error);
      const uncertain=!(error instanceof MidtransProviderError)||error.retryable;
      await Promise.resolve(admin.from("payment_attempts").update({ status: uncertain?"pending":"failed", provider_status: uncertain?"creation_unknown":"failed", updated_at: new Date().toISOString() }).eq("id", attemptId)).catch(() => undefined);
      return fail(mapped.message, mapped.code, mapped.status);
    }
    if (checkout.orderId !== localProviderOrderId) {
      await Promise.resolve(admin.from("payment_attempts").update({ status: "pending", provider_status: "order_id_mismatch", updated_at: new Date().toISOString() }).eq("id", attemptId)).catch(() => undefined);
      return fail("Provider mengembalikan order pembayaran yang tidak sesuai", "PAYMENT_PROVIDER_REJECTED", 502);
    }
    const updateResult = await admin.from("payment_attempts").update({ provider_status: "pending", provider_payload: safeProviderPayload(checkout.raw), updated_at: new Date().toISOString() }).eq("id", attemptId);
    if (updateResult?.error) return fail("Percobaan pembayaran belum dapat diperbarui", "PAYMENT_ATTEMPT_FAILED", 503);
    const sessionInsert = await admin.from("payment_checkout_sessions").insert({ id: randomUUID(), payment_attempt_id: attemptId, snap_token: checkout.token, redirect_url: checkout.redirectUrl, expires_at: closesAt });
    if (sessionInsert?.error) {
      await Promise.resolve(admin.from("payment_attempts").update({ status: "pending", provider_status: "session_persist_failed", updated_at: new Date().toISOString() }).eq("id", attemptId)).catch(() => undefined);
      return fail("Sesi checkout belum dapat disimpan", "PAYMENT_CHECKOUT_SESSION_FAILED", 503);
    }
    return attemptResponse({id:attemptId,provider_order_id:localProviderOrderId,status:"pending",integration_type:"snap",provider_status:"pending",expires_at:closesAt},{snap_token:checkout.token,redirect_url:checkout.redirectUrl,expires_at:closesAt},serverTime,snapshot,201);
  } finally {
    await releasePaymentLock(orderId, lock.token).catch(() => undefined);
  }
}
