"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, CreditCard, MapPin, RefreshCw, XCircle } from "lucide-react";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { parsePaymentApiError, type PaymentApiError } from "@/lib/payments/client-errors";
import { derivePaymentUiState, formatPaymentMethod, type PaymentReconcileState, type PaymentUiState } from "@/lib/payments/ui-state";
import { invokeSnapPay } from "@/lib/payments/snap-client";
import MidtransSnapLoader, { type MidtransSnapConfig, type SnapLoaderState } from "./MidtransSnapLoader";
import { usePaymentWindowCountdown } from "./usePaymentWindowCountdown";

import { Spinner } from "@/components/feedback";
import { feedbackError } from "@/lib/feedback/errors";

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: { onSuccess?: (result?: unknown) => void; onPending?: (result?: unknown) => void; onError?: (result?: unknown) => void; onClose?: (result?: unknown) => void }) => void };
  }
}

type CheckoutAttempt = NonNullable<UmkmOrderDetail["paymentAttempt"]> & { snapToken?: string | null; redirectUrl?: string | null };
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : `${dateTime.format(parsed)} WIB`;
}

function stateCopy(state: PaymentUiState): { title: string; description: string } {
  const copy: Record<PaymentUiState, { title: string; description: string }> = {
    before_window: { title: "Menunggu jendela pembayaran", description: "Checkout akan tersedia ketika waktu pembayaran dibuka." },
    checkout_ready: { title: "Belum memilih metode pembayaran", description: "Pilih metode pembayaran di checkout Midtrans untuk melanjutkan." },
    checkout_created: { title: "Checkout sudah dibuat", description: "Checkout sudah siap, tetapi metode pembayaran belum selesai dipilih." },
    method_confirming: { title: "Mengonfirmasi pilihan metode…", description: "Kami sedang memeriksa pilihan Anda ke server pembayaran." },
    awaiting_payment: { title: "Menunggu pembayaran", description: "Selesaikan pembayaran di checkout Midtrans sebelum batas waktu berakhir." },
    reconciling: { title: "Memeriksa status pembayaran…", description: "Status hanya dapat berubah setelah dikonfirmasi server Midtrans." },
    paid: { title: "Pembayaran terkonfirmasi", description: "Pembayaran sudah diterima. Ikuti jadwal persiapan dan pengambilan barang." },
    retryable_failure: { title: "Pembayaran belum selesai", description: "Checkout belum dapat dibuka. Anda dapat mencoba lagi atau membuka checkout langsung." },
    cancelled: { title: "Pesanan dibatalkan", description: "Pembayaran tidak tersedia untuk pesanan ini. Lihat alasan pembatalan pada detail pesanan atau hubungi bantuan." },
    expired: { title: "Waktu pembayaran berakhir", description: "Jendela pembayaran sudah ditutup dan checkout tidak dapat dilanjutkan." },
    unknown: { title: "Status pembayaran belum terkonfirmasi", description: "Periksa status sebelum membayar ulang. Hasil pembayaran mengikuti konfirmasi server." },
    unavailable: { title: "Pembayaran belum tersedia", description: "Jadwal atau kemampuan pembayaran belum tersedia. Coba muat ulang." },
  };
  return copy[state];
}

function PaymentWindowHeader({ order, countdown, onRetry }: { order: UmkmOrderDetail; countdown: ReturnType<typeof usePaymentWindowCountdown>; onRetry: () => void }) {
  const open = order.timeline.paymentOpensAt;
  const close = order.timeline.paymentClosesAt;
  const tone = countdown.urgency === "critical" ? "bg-rose-50 text-rose-700" : countdown.urgency === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Clock3 className="size-4 text-slate-400" />{countdown.state === "expired" ? "Waktu pembayaran berakhir" : order.phase === "waiting_payment_window" ? "Menunggu jendela pembayaran dibuka" : "Sisa waktu pembayaran"}</div>{countdown.state === "running" || countdown.state === "expired" ? <span role="timer" aria-live="off" className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${tone}`}>{countdown.formatted}</span> : <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-500">{countdown.formatted}</span>}</div><div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><p><CalendarClock className="mr-1 inline size-3.5" />Buka: <strong className="text-slate-700">{formatDate(open)}</strong></p><p><CalendarClock className="mr-1 inline size-3.5" />Batas akhir: <strong className="text-slate-700">{formatDate(close)}</strong></p></div>{countdown.state === "unavailable" && <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><span>Jadwal pembayaran belum tersedia.</span><button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="size-3" />Coba lagi</button></div>}</section>;
}

function InvoiceCard({ order, amount }: { order: UmkmOrderDetail; amount: number | null }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3"><span className="text-sm font-bold uppercase tracking-wide text-slate-700">Tagihan Final</span><span className="font-mono text-xs text-blue-600">{order.batchDisplayCode}</span></header><div className="space-y-3 p-5"><div className="flex justify-between text-sm"><span>Kuantitas</span><strong>{order.quantity} {order.unit}</strong></div><div className="flex justify-between text-sm"><span>Harga terkunci (Tier {order.lockedTier ?? 1})</span><strong>{order.lockedUnitPrice == null ? "—" : `${money.format(order.lockedUnitPrice)} / ${order.unit}`}</strong></div><div className="flex justify-between border-t border-dashed pt-3 text-base"><strong>Total Tagihan</strong><strong className="text-xl">{amount === null ? "—" : money.format(amount)}</strong></div><p className="text-xs text-slate-500"><MapPin className="mr-1 inline size-3.5" />{order.pickupAddress ?? order.pickup?.address ?? "Lokasi pickup mengikuti detail batch."}</p></div></section>;
}

export default function UmkmPaymentPanel({ order, onReload, snapConfig }: { order: UmkmOrderDetail; onReload: () => void; snapConfig?: MidtransSnapConfig }) {
  const initialAttempt = order.paymentAttempt as CheckoutAttempt | null;
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(initialAttempt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentError, setPaymentError] = useState<PaymentApiError | null>(null);
  const [lastAction, setLastAction] = useState<"charge" | "reconcile" | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(initialAttempt?.redirectUrl ?? null);
  const [snapState, setSnapState] = useState<SnapLoaderState>(snapConfig ? "loading" : "error");
  const [reconcileState, setReconcileState] = useState<PaymentReconcileState>("idle");
  const [serverTime, setServerTime] = useState(order.serverTime);
  useEffect(() => {
    const nextAttempt = order.paymentAttempt as CheckoutAttempt | null;
    const task = window.setTimeout(() => {
      setAttempt(nextAttempt);
      setRedirectUrl(nextAttempt?.redirectUrl ?? null);
      setServerTime(order.serverTime);
    }, 0);
    return () => window.clearTimeout(task);
  }, [order.paymentAttempt, order.serverTime]);
  const handleSnapState = useCallback((state: SnapLoaderState) => {
    setSnapState(state);
    if (state === "blocked") setMessage("Menyiapkan ulang checkout Midtrans…");
    if (state === "ready") setMessage((current) => current === "Menyiapkan ulang checkout Midtrans…" ? "" : current);
  }, []);
  const handleSnapRecoveryExhausted = useCallback(() => {
    setPaymentError({ message: "Popup diblokir oleh keamanan browser. Gunakan checkout langsung.", code: "SNAP_CSP_BLOCKED" });
  }, []);
  const expiryReconciled = useRef(false);
  const inFlight = useRef(false);
  const pollBudget = useRef({key: "", runs: 0});
  const latestReconcile = useRef<() => void>(() => {});
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(order.paymentProgress);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => { const task = window.setTimeout(() => setProgress(order.paymentProgress), 0); return () => window.clearTimeout(task); }, [order.paymentProgress]);
  const windowDeadline = ["waiting_payment_window", "registered"].includes(order.phase) ? order.timeline.paymentOpensAt : order.timeline.paymentClosesAt;
  const deadline = windowDeadline;
  const countdown = usePaymentWindowCountdown(serverTime, deadline);
  const amount = order.invoice?.grossAmount ?? order.finalAmount;
  const derivedUiState = derivePaymentUiState({ phase: countdown.state === "expired" && order.phase === "payment_open" ? "payment_expired" : order.phase, orderStatus: order.status, canPay: order.capabilities.canPay, attempt, snapState, reconcileState, hasCheckoutRedirect: Boolean(redirectUrl), hasError: Boolean(paymentError) });
  const uiState: PaymentUiState = reconcileState === "running" || reconcileState === "confirming" ? "reconciling" : progress?.state === "status_unknown" ? "unavailable" : progress?.state === "cancelled" ? "cancelled" : progress?.state === "expired" ? "expired" : progress?.state === "paid" ? "paid" : progress?.state === "awaiting_payment" ? "awaiting_payment" : progress?.state === "failed" ? "retryable_failure" : derivedUiState;
  const unknown = progress?.state === "status_unknown" || order.phase === "payment_verifying";
  const refund = order.status === "refund_pending" || order.status === "refunded";
  const integrityIssue = progress?.blockedCode === "ORDER_STATUS_INCONSISTENT";
  const copy = integrityIssue ? {title:"Status pesanan perlu diperiksa",description:progress.blockedReason ?? "Muat ulang detail atau hubungi bantuan transaksi sebelum membayar."} : refund ? {title: order.status === "refunded" ? "Dana sudah dikembalikan" : "Pengembalian dana diproses", description:"Pembayaran tercatat. Ikuti proses pengembalian dana pada detail pesanan."} : order.status === "no_show" ? {title:"Batas pengambilan terlewat",description:"Status pesanan mengikuti ketentuan pengambilan. Tidak tersedia pembayaran tambahan."} : unknown && reconcileState !== "running" && reconcileState !== "confirming" ? {title: "Status pembayaran belum terkonfirmasi", description:"Periksa status ke Midtrans. Jangan membayar ulang sebelum hasil pemeriksaan tersedia."} : stateCopy(uiState);
  const canOpen = !refund && !unknown && countdown.state !== "expired" && (progress?.canOpenCheckout ?? order.capabilities.canPay);
  const canCheck = progress?.canCheckStatus ?? Boolean(!refund && !["paid","picked_up","completed"].includes(order.status) && (attempt || order.invoice?.midtransOrderId));
  const method = formatPaymentMethod(attempt?.paymentMethod);

  const reconcile = useCallback(async (reason: "method" | "manual" | "automatic" = "manual") => {
    if (reason !== "manual") { const key = order.id + ":" + (attempt?.id ?? "invoice"); if (pollBudget.current.key !== key) pollBudget.current = {key,runs:0}; if (pollBudget.current.runs >= 4) return; if (!inFlight.current) pollBudget.current.runs++; }
    if (inFlight.current) return;
    inFlight.current = true; abort.current = new AbortController();
    setLastAction("reconcile"); setBusy(true); setReconcileState(reason === "method" ? "confirming" : "running"); setMessage(""); setPaymentError(null);
    try {
      const response = await fetch(`/api/umkm/orders/${order.id}/payment/reconcile`, { method: "POST", signal: abort.current.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setReconcileState("error"); setPaymentError(parsePaymentApiError(body, "Status pembayaran belum dapat dicek.")); return; }
      if (!mounted.current) return;
      if (typeof body.serverTime === "string") setServerTime(body.serverTime);
      if (body.paymentProgress) setProgress(body.paymentProgress);
      setAttempt((current) => current ? { ...current, providerStatus: typeof body.status === "string" ? body.status : current.providerStatus, paymentMethod: typeof body.paymentType === "string" ? body.paymentType : current.paymentMethod, status: body.attemptStatus ?? (body.localStatus === "paid" ? "paid" : current.status) } : current);
      try { await onReload(); } catch { setMessage("Status pembayaran tersimpan, tetapi tampilan belum diperbarui. Muat ulang detail."); return; }
      if (body.localStatus === "paid" || ["refund_pending","refunded","cancelled"].includes(body.localStatus)) { setMessage(""); return; }
      if (["expire","deny","cancel"].includes(body.status)) { setMessage(body.status === "expire" ? "Midtrans mengonfirmasi percobaan pembayaran telah kedaluwarsa." : "Midtrans mengonfirmasi pembayaran belum berhasil."); return; }
      setMessage(body.paymentType ? `Metode ${formatPaymentMethod(body.paymentType) ?? "pembayaran"} sudah tercatat. Selesaikan pembayaran di checkout.` : "Checkout masih menunggu pilihan atau konfirmasi pembayaran.");
    } catch (reason: unknown) { setReconcileState("error"); setPaymentError({ message: feedbackError(reason, "Status pembayaran belum terkonfirmasi. Cek status sebelum membayar ulang.") }); }
    finally { inFlight.current = false; if (mounted.current) { setBusy(false); setReconcileState("idle"); } }
  }, [order.id, onReload, attempt?.id]);

  const openSnap = useCallback((token: string) => {
    const result = invokeSnapPay(window.snap, token, { onSuccess: () => { void reconcile("automatic"); }, onPending: () => { setMessage("Mengonfirmasi pilihan metode pembayaran…"); void reconcile("method"); }, onError: () => { setMessage("Pembayaran belum berhasil. Anda dapat memilih metode lain."); void reconcile("automatic"); }, onClose: () => { setMessage("Checkout ditutup. Memeriksa status pembayaran Anda…"); void reconcile("automatic"); } });
    if (!result.ok) setPaymentError({ message: result.code === "SNAP_NOT_READY" ? "Checkout Midtrans belum siap. Coba lagi atau buka checkout langsung." : "Checkout Midtrans gagal dibuka. Coba lagi atau buka checkout langsung.", code: result.code });
  }, [reconcile]);

  const charge = useCallback(async () => {
    if (inFlight.current || !canOpen) return;
    inFlight.current = true; abort.current = new AbortController();
    setLastAction("charge"); setBusy(true); setMessage(""); setPaymentError(null);
    try {
      const response = await fetch(`/api/umkm/orders/${order.id}/payment/charge`, { method: "POST", signal: abort.current.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setPaymentError(parsePaymentApiError(body, "Pembayaran belum dapat dibuat.")); return; }
      if (!mounted.current) return;
      if (body.paymentProgress) setProgress(body.paymentProgress);
      if (typeof body.serverTime === "string") setServerTime(body.serverTime);
      const next = body.attempt as CheckoutAttempt;
      setAttempt(next); setRedirectUrl(next.redirectUrl ?? null);
      if (next.checkoutMode === "snap") {
        if (!next.snapToken || !next.redirectUrl) { setPaymentError({ message: "Sesi checkout Midtrans belum lengkap. Coba lagi.", code: "PAYMENT_CHECKOUT_SESSION_FAILED" }); return; }
        openSnap(next.snapToken);
      }
    } catch (reason: unknown) { setPaymentError({ message: feedbackError(reason, "Hasil penyiapan pembayaran belum terkonfirmasi. Cek status sebelum mencoba pembayaran ulang.") }); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }, [openSnap, order.id, canOpen]);

  const retry = useCallback(() => { if (lastAction === "reconcile") void reconcile(); else void charge(); }, [charge, lastAction, reconcile]);
  const openRedirect = useCallback(() => { if (redirectUrl) window.location.assign(redirectUrl); else setPaymentError({ message: "Link checkout belum tersedia. Coba buat sesi pembayaran lagi.", code: "PAYMENT_CHECKOUT_REDIRECT_MISSING" }); }, [redirectUrl]);

  useEffect(() => {
    expiryReconciled.current = false;
  }, [order.id, deadline]);

  useEffect(() => { latestReconcile.current = () => { void reconcile("automatic"); }; }, [reconcile]);
  useEffect(() => {
    if (!attempt?.id || attempt?.status !== "pending" || order.status !== "pending_payment") return;
    const key = order.id + ":" + attempt.id;
    if (pollBudget.current.key !== key) pollBudget.current = {key, runs: 0};
    const tick = () => { if (document.visibilityState === "hidden" || inFlight.current || pollBudget.current.runs >= 4) return; latestReconcile.current(); };
    const timer = window.setInterval(tick, 15_000);
    const visible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [attempt?.id, attempt?.status, order.id, order.status]);

  useEffect(() => {
    if (countdown.state !== "expired" || expiryReconciled.current) return;
    expiryReconciled.current = true;
    const task = window.setTimeout(() => {
      if (order.phase === "payment_open" && attempt && canCheck) void reconcile("automatic");
      else if (order.phase === "waiting_payment_window") void onReload();
    }, 0);
    return () => window.clearTimeout(task);
  }, [countdown.state, order.phase, onReload, reconcile, attempt, canCheck]);

  const legacyQr = attempt?.checkoutMode === "core_qris" && attempt.qrCodeUrl ? <img src={attempt.qrCodeUrl} alt="QRIS pembayaran Midtrans" className="mx-auto mt-5 size-56 rounded-lg border border-slate-200 object-contain" /> : null;
  const primary = uiState === "paid" ? <Link href={order.phase === "ready_for_pickup" ? `/pesanan/${order.id}/serah-terima` : `/umkm/pesanan/${order.id}#jadwal`} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">{order.phase === "ready_for_pickup" ? "Tampilkan QR/PIN" : "Lihat jadwal pengambilan"}</Link> : canOpen ? <button type="button" onClick={() => void charge()} disabled={busy || snapState === "loading" || snapState === "blocked"} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{busy || snapState === "loading" ? <Spinner /> : <CreditCard className="size-4" />}{busy ? "Memproses…" : snapState === "loading" ? "Menyiapkan checkout…" : attempt && ["failed", "expired"].includes(attempt.status) ? "Coba bayar lagi" : attempt ? "Lanjutkan pembayaran" : "Bayar sekarang"}</button> : null;
  const showDirectFallback = Boolean(canOpen && redirectUrl && (paymentError || snapState === "error" || snapState === "blocked"));

  return <div id="pembayaran" className="space-y-5">
    {integrityIssue && <button type="button" onClick={onReload} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700"><RefreshCw className="size-4" aria-hidden="true" />Muat ulang detail</button>}
    {snapConfig && canOpen && <MidtransSnapLoader orderId={order.id} config={snapConfig} onStateChange={handleSnapState} onRecoveryExhausted={handleSnapRecoveryExhausted} />}
    {!order.invoice && uiState !== "paid" && !refund && <PaymentWindowHeader order={order} countdown={countdown} onRetry={onReload} />}
    <section aria-label="Status pembayaran Midtrans" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className={`mt-0.5 rounded-full p-2 ${uiState === "paid" ? "bg-emerald-100 text-emerald-600" : uiState === "expired" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>{uiState === "paid" ? <CheckCircle2 className="size-5" /> : uiState === "expired" ? <XCircle className="size-5" /> : <CreditCard className="size-5" />}</div><div className="min-w-0 flex-1"><h2 className="wesup-state-title text-xl text-slate-900" role="status">{copy.title}</h2><p className="mt-1 text-sm text-slate-600">{copy.description}</p>{legacyQr}{attempt?.expiresAt && <p className="mt-2 text-xs text-slate-500">Batas percobaan checkout: {formatDate(attempt.expiresAt)}. Batas bayar pesanan mengikuti jadwal di bawah.</p>}{method && <p className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Metode dipilih: {method}</p>}{amount !== null && <p className="mt-3 text-xl font-extrabold text-slate-900">{money.format(amount)}</p>}</div></div>{order.invoice && uiState !== "paid" && !refund && <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">Batas bayar: <strong>{formatDate(order.timeline.paymentClosesAt)}</strong>{countdown.state === "running" && <span role="timer" aria-live="off" className="rounded-full bg-blue-50 px-2 py-1 font-mono text-blue-700">{countdown.formatted}</span>}</p>}<div className="mt-5 flex flex-wrap gap-2">{primary}{canCheck && <button type="button" disabled={busy} onClick={() => void reconcile()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className="size-4" />{busy && lastAction === "reconcile" ? "Memeriksa…" : "Cek status pembayaran"}</button>}</div>{progress?.lastCheckedAt && <p className="mt-3 text-xs text-slate-500">Terakhir diperiksa: {formatDate(progress.lastCheckedAt)}</p>}{uiState === "paid" && order.invoice?.paidAt && <p className="mt-3 text-sm">Dibayar pada {formatDate(order.invoice.paidAt)}</p>}{(message || paymentError) && <div role={paymentError ? "alert" : "status"} className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><p>{paymentError?.message ?? message}</p>{paymentError?.requestId && <p className="mt-1 font-mono text-[10px]">Referensi: {paymentError.requestId}</p>}{paymentError && <button type="button" onClick={retry} disabled={busy} className="mt-2 inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-xs font-semibold disabled:opacity-50"><RefreshCw className="size-3" />Coba lagi</button>}</div>}{showDirectFallback && <button type="button" onClick={openRedirect} disabled={busy} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-700"><CreditCard className="size-4" />Buka checkout langsung</button>}</section>
    {order.invoice && <InvoiceCard order={order} amount={amount} />}
  </div>;
}
