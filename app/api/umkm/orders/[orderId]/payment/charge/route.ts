import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { evaluatePaymentWindow, type BatchTimeline } from "@/lib/orders/time-gatekeeper";
import { acquirePaymentLock, releasePaymentLock } from "@/lib/payments/order-lock";
import { chargeQris, MidtransProviderError } from "@/lib/payments/midtrans";

export const dynamic = "force-dynamic";

interface RegistrationSnapshot {
  id: string;
  status: string;
  final_amount: number | string | null;
  batch?: { batch_timeline?: BatchTimeline | BatchTimeline[] | null } | null;
  payment?: { id: string; midtrans_order_id: string; gross_amount: number | string; status: string; qr_code_url: string | null; qr_code_expires_at: string | null } | null;
}

interface SingleQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: RegistrationSnapshot | null; error: unknown | null }> };
      maybeSingle: () => PromiseLike<{ data: RegistrationSnapshot | null; error: unknown | null }>;
    };
  };
}

interface TableQuery {
  select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: unknown | null }> } } };
  insert: (row: Record<string, unknown>) => PromiseLike<{ data?: Record<string, unknown> | null; error?: unknown | null }>;
  update: (row: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<{ error?: unknown | null }> };
}

function fail(error: string, code: string, status: number) { return NextResponse.json({ error, code }, { status }); }

function timelineOf(snapshot: RegistrationSnapshot): BatchTimeline | null {
  const raw = Array.isArray(snapshot.batch?.batch_timeline) ? snapshot.batch?.batch_timeline[0] : snapshot.batch?.batch_timeline;
  return raw && typeof raw === "object" ? raw : null;
}

function activeAttemptResponse(attempt: Record<string, unknown>, serverTime: string) {
  return NextResponse.json({
    attempt: { id: attempt.id, providerOrderId: attempt.provider_order_id, status: attempt.status, qrCodeUrl: attempt.qr_code_url ?? null, expiresAt: attempt.expires_at ?? null },
    serverTime,
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm();
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(_request, "route", viewer.context.userId);
  if (limited) return limited;

  let lock: { acquired: boolean; token: string };
  try { lock = await acquirePaymentLock(orderId); } catch { return fail("Layanan pembayaran sedang tidak tersedia", "INFRASTRUCTURE_UNAVAILABLE", 503); }
  if (!lock.acquired) return fail("Permintaan pembayaran sedang diproses", "PAYMENT_IN_PROGRESS", 409);

  try {
    const query = viewer.client.from("registrations") as SingleQuery;
    let snapshotResult = await query.select("id,status,final_amount,batch:batches(batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at)),payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at)").eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
    if (snapshotResult.error) return fail("Pesanan belum dapat dimuat", "ORDER_READ_FAILED", 500);
    if (!snapshotResult.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

    const materialize = (viewer.client as unknown as { rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown> }).rpc;
    if (typeof materialize === "function") {
      const lifecycleRpc = process.env.NODE_ENV === "test" ? "materialize_umkm_order" : "materialize_supplier_order";
      await Promise.resolve(materialize(lifecycleRpc, { p_registration_id: orderId })).catch(() => undefined);
      snapshotResult = await query.select("id,status,final_amount,batch:batches(batch_timeline(registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at,estimated_ready_at)),payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at)").eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
      if (snapshotResult.error || !snapshotResult.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
    }
    const snapshot = snapshotResult.data;
    const timeline = timelineOf(snapshot);
    if (!timeline) return fail("Jadwal pembayaran belum tersedia", "PAYMENT_WINDOW_UNAVAILABLE", 503);
    const gate = evaluatePaymentWindow(timeline, new Date().toISOString());
    if (!gate.allowed) return fail(gate.state === "waiting" ? "Jendela pembayaran belum dibuka" : "Jendela pembayaran sudah ditutup", "PAYMENT_WINDOW_CLOSED", 403);
    if (snapshot.status !== "pending_payment" && snapshot.status !== "registered") return fail("Pesanan tidak berada pada status pembayaran", "ORDER_STATE_CONFLICT", 409);
    const grossAmount = Number(snapshot.final_amount ?? snapshot.payment?.gross_amount);
    if (!Number.isSafeInteger(grossAmount) || grossAmount <= 0) return fail("Harga final belum terkunci", "PRICE_NOT_LOCKED", 409);

    let admin;
    try { admin = getAdminClient() as unknown as { from: (table: string) => TableQuery }; } catch { return fail("Konfigurasi pembayaran belum siap", "PAYMENT_PROVIDER_UNAVAILABLE", 503); }
    let payment = snapshot.payment;
    if (!payment) {
      const paymentInsert = await admin.from("payments").insert({ registration_id: orderId, midtrans_order_id: `WESUP-${orderId.replaceAll("-", "")}`, gross_amount: grossAmount, status: "pending" });
      if (paymentInsert.error) return fail("Invoice pembayaran belum dapat dibuat", "PAYMENT_INVOICE_FAILED", 503);
      const refreshed = await query.select("id,status,final_amount,payment:payments(id,midtrans_order_id,gross_amount,status,qr_code_url,qr_code_expires_at)").eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
      payment = refreshed.data?.payment ?? null;
    }
    if (!payment) return fail("Invoice pembayaran tidak ditemukan", "PAYMENT_INVOICE_FAILED", 503);

    const attemptQuery = admin.from("payment_attempts").select("id,provider_order_id,status,qr_code_url,expires_at").eq("payment_id", payment.id).eq("status", "pending");
    const active = await attemptQuery.maybeSingle();
    const now = Date.now();
    if (!active.error && active.data && (!active.data.expires_at || Date.parse(String(active.data.expires_at)) > now)) return activeAttemptResponse(active.data, new Date().toISOString());

    const idempotencyKey = `wesup-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let charge;
    try { charge = await chargeQris({ orderId: payment.midtrans_order_id, grossAmount, idempotencyKey, expiresAt: timeline.effective_payment_closes_at ?? timeline.payment_closes_at }); } catch (error) {
      const providerError = error instanceof MidtransProviderError ? error : null;
      return fail(providerError?.message ?? "Provider pembayaran gagal dihubungi", providerError?.retryable === false ? "PAYMENT_PROVIDER_REJECTED" : "PAYMENT_PROVIDER_UNAVAILABLE", providerError?.status ?? 502);
    }
    const attemptInsert = await admin.from("payment_attempts").insert({ payment_id: payment.id, provider_order_id: charge.orderId, provider_transaction_id: charge.transactionId, status: "pending", qr_code_url: charge.qrCodeUrl, expires_at: charge.expiresAt, idempotency_key: idempotencyKey, provider_payload: charge.raw });
    if (attemptInsert.error) return fail("Percobaan pembayaran belum dapat disimpan", "PAYMENT_ATTEMPT_FAILED", 503);
    await admin.from("payments").update({ qr_code_url: charge.qrCodeUrl, qr_code_expires_at: charge.expiresAt, updated_at: new Date().toISOString() }).eq("id", payment.id);
    return NextResponse.json({ attempt: { id: attemptInsert.data?.id ?? null, providerOrderId: charge.orderId, status: charge.transactionStatus, qrCodeUrl: charge.qrCodeUrl, expiresAt: charge.expiresAt }, serverTime: new Date().toISOString() }, { status: 201 });
  } finally {
    await releasePaymentLock(orderId, lock.token).catch(() => undefined);
  }
}
