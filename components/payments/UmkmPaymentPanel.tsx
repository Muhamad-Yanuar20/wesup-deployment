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
  return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed);
}

function stateCopy(state: PaymentUiState): { title: string; description: string } {
  const copy: Record<PaymentUiState, { title: string; description: string }> = {
    before_window: { title: "Menunggu jendela pembayaran", description: "Checkout akan tersedia ketika waktu pembayaran dibuka." },
    checkout_ready: { title: "Belum memilih metode pembayaran", description: "Pilih metode pembayaran di checkout Midtrans untuk melanjutkan." },
    checkout_created: { title: "Checkout sudah dibuat", description: "Checkout sudah siap, tetapi metode pembayaran belum selesai dipilih." },
    method_confirming: { title: "Mengonfirmasi pilihan metode…", description: "Kami sedang memeriksa pilihan Anda ke server pembayaran." },
    awaiting_payment: { title: "Menunggu pembayaran", description: "Selesaikan pembayaran di checkout Midtrans sebelum batas waktu berakhir." },
    reconciling: { title: "Memeriksa status pembayaran…", description: "Status hanya dapat berubah setelah dikonfirmasi server Midtrans." },
    paid: { title: "Pembayaran terkonfirmasi", description: "Pembayaran sudah diterima. Lanjutkan ke halaman kode pengambilan." },
    retryable_failure: { title: "Pembayaran belum selesai", description: "Checkout belum dapat dibuka. Anda dapat mencoba lagi atau membuka checkout langsung." },
    expired: { title: "Waktu pembayaran berakhir", description: "Jendela pembayaran sudah ditutup dan checkout tidak dapat dilanjutkan." },
    unavailable: { title: "Pembayaran belum tersedia", description: "Jadwal atau kemampuan pembayaran belum tersedia. Coba muat ulang." },
  };
  return copy[state];
}

function PaymentWindowHeader({ order, countdown, deadline, onRetry }: { order: UmkmOrderDetail; countdown: ReturnType<typeof usePaymentWindowCountdown>; deadline: string | null; onRetry: () => void }) {
  const open = order.timeline.paymentOpensAt;
  const close = deadline ?? order.timeline.paymentClosesAt;
  const tone = countdown.urgency === "critical" ? "bg-rose-50 text-rose-700" : countdown.urgency === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Clock3 className="size-4 text-slate-400" />{countdown.state === "expired" ? "Waktu pembayaran berakhir" : order.phase === "waiting_payment_window" ? "Menunggu jendela pembayaran dibuka" : "Sisa waktu pembayaran"}</div>{countdown.state === "running" || countdown.state === "expired" ? <span role="timer" aria-live="polite" className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${tone}`}>{countdown.formatted}</span> : <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-500">{countdown.formatted}</span>}</div><div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><p><CalendarClock className="mr-1 inline size-3.5" />Buka: <strong className="text-slate-700">{formatDate(open)}</strong></p><p><CalendarClock className="mr-1 inline size-3.5" />Batas akhir: <strong className="text-slate-700">{formatDate(close)}</strong></p></div>{countdown.state === "unavailable" && <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><span>Jadwal pembayaran belum tersedia.</span><button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="size-3" />Coba lagi</button></div>}</section>;
}

function InvoiceCard({ order, amount }: { order: UmkmOrderDetail; amount: number | null }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3"><span className="text-sm font-bold uppercase tracking-wide text-slate-700">Tagihan Final</span><span className="font-mono text-xs text-blue-600">{order.batchDisplayCode}</span></header><div className="space-y-3 p-5"><div className="flex justify-between text-sm"><span>Kuantitas</span><strong>{order.quantity} {order.unit}</strong></div><div className="flex justify-between text-sm"><span>Harga terkunci (Tier {order.lockedTier ?? 1})</span><strong>{order.finalAmount === null ? "—" : money.format(order.finalAmount)}</strong></div><div className="flex justify-between border-t border-dashed pt-3 text-base"><strong>Total Tagihan</strong><strong className="text-xl">{amount === null ? "—" : money.format(amount)}</strong></div><p className="text-xs text-slate-500"><MapPin className="mr-1 inline size-3.5" />{order.pickup?.address ?? "Lokasi pickup mengikuti detail batch."}</p></div></section>;
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
  const handleSnapState = useCallback((state: SnapLoaderState) => {
    setSnapState(state);
    if (state === "blocked") setMessage("Menyiapkan ulang checkout Midtrans…");
    if (state === "ready") setMessage((current) => current === "Menyiapkan ulang checkout Midtrans…" ? "" : current);
  }, []);
  const handleSnapRecoveryExhausted = useCallback(() => {
    setPaymentError({ message: "Popup diblokir oleh keamanan browser. Gunakan checkout langsung.", code: "SNAP_CSP_BLOCKED" });
  }, []);
  const expiryReconciled = useRef(false);
  const windowDeadline = order.phase === "payment_open" ? order.timeline.paymentClosesAt : order.timeline.paymentOpensAt;
  const candidateDeadlines = [windowDeadline, attempt?.expiresAt ?? null].filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))));
  const deadline = candidateDeadlines.sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
  const countdown = usePaymentWindowCountdown(serverTime, deadline);
  const amount = order.invoice?.grossAmount ?? order.finalAmount;
  const uiState = derivePaymentUiState({ phase: countdown.state === "expired" && order.phase === "payment_open" ? "payment_expired" : order.phase, orderStatus: order.status, canPay: order.capabilities.canPay, attempt, snapState, reconcileState, hasCheckoutRedirect: Boolean(redirectUrl), hasError: Boolean(paymentError) });
  const copy = stateCopy(uiState);
  const method = formatPaymentMethod(attempt?.paymentMethod);

  const reconcile = useCallback(async (reason: "method" | "manual" = "manual") => {
    setLastAction("reconcile"); setBusy(true); setReconcileState(reason === "method" ? "confirming" : "running"); setMessage(""); setPaymentError(null);
    try {
      const response = await fetch(`/api/umkm/orders/${order.id}/payment/reconcile`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setReconcileState("error"); setPaymentError(parsePaymentApiError(body, "Status pembayaran belum dapat dicek.")); return; }
      if (typeof body.serverTime === "string") setServerTime(body.serverTime);
      setAttempt((current) => current ? { ...current, providerStatus: typeof body.status === "string" ? body.status : current.providerStatus, paymentMethod: typeof body.paymentType === "string" ? body.paymentType : current.paymentMethod, status: body.localStatus === "paid" ? "paid" : current.status } : current);
      if (body.localStatus === "paid" || body.status === "settlement" || body.status === "capture") { onReload(); return; }
      setMessage(body.paymentType ? `Metode ${formatPaymentMethod(body.paymentType) ?? "pembayaran"} sudah tercatat. Selesaikan pembayaran di checkout.` : "Checkout masih menunggu pilihan atau konfirmasi pembayaran.");
    } catch (reason: unknown) { setReconcileState("error"); setPaymentError({ message: reason instanceof Error ? reason.message : "Status pembayaran belum dapat dicek." }); }
    finally { setBusy(false); setReconcileState("idle"); }
  }, [order.id, onReload]);

  const openSnap = useCallback((token: string) => {
    const result = invokeSnapPay(window.snap, token, { onSuccess: () => { void reconcile(); }, onPending: () => { setMessage("Mengonfirmasi pilihan metode pembayaran…"); void reconcile("method"); }, onError: () => { setMessage("Pembayaran belum berhasil. Anda dapat memilih metode lain."); void reconcile(); }, onClose: () => { setMessage("Checkout ditutup. Pesanan belum dibayar; Anda dapat membukanya kembali."); } });
    if (!result.ok) setPaymentError({ message: result.code === "SNAP_NOT_READY" ? "Checkout Midtrans belum siap. Coba lagi atau buka checkout langsung." : "Checkout Midtrans gagal dibuka. Coba lagi atau buka checkout langsung.", code: result.code });
  }, [reconcile]);

  const charge = useCallback(async () => {
    setLastAction("charge"); setBusy(true); setMessage(""); setPaymentError(null);
    try {
      const response = await fetch(`/api/umkm/orders/${order.id}/payment/charge`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setPaymentError(parsePaymentApiError(body, "Pembayaran belum dapat dibuat.")); return; }
      const next = body.attempt as CheckoutAttempt;
      setAttempt(next); setRedirectUrl(next.redirectUrl ?? null);
      if (next.checkoutMode === "snap") {
        if (!next.snapToken || !next.redirectUrl) { setPaymentError({ message: "Sesi checkout Midtrans belum lengkap. Coba lagi.", code: "PAYMENT_CHECKOUT_SESSION_FAILED" }); return; }
        openSnap(next.snapToken);
      }
    } catch (reason: unknown) { setPaymentError({ message: reason instanceof Error ? reason.message : "Pembayaran belum dapat dibuat." }); }
    finally { setBusy(false); }
  }, [openSnap, order.id]);

  const retry = useCallback(() => { if (lastAction === "reconcile") void reconcile(); else void charge(); }, [charge, lastAction, reconcile]);
  const openRedirect = useCallback(() => { if (redirectUrl) window.location.assign(redirectUrl); else setPaymentError({ message: "Link checkout belum tersedia. Coba buat sesi pembayaran lagi.", code: "PAYMENT_CHECKOUT_REDIRECT_MISSING" }); }, [redirectUrl]);

  useEffect(() => {
    expiryReconciled.current = false;
  }, [order.id, deadline]);

  useEffect(() => {
    if (!attempt || order.status !== "pending_payment" || typeof document === "undefined") return;
    let runs = 0;
    const tick = () => { if (document.visibilityState === "hidden" || runs >= 4) return; runs += 1; void reconcile(); };
    const timer = window.setInterval(tick, 15_000);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [attempt, order.status, reconcile]);

  useEffect(() => {
    if (countdown.state !== "expired" || expiryReconciled.current) return;
    expiryReconciled.current = true;
    const task = window.setTimeout(() => { if (order.phase === "payment_open") void reconcile(); else onReload(); }, 0);
    return () => window.clearTimeout(task);
  }, [countdown.state, order.phase, onReload, reconcile]);

  const legacyQr = attempt?.checkoutMode === "core_qris" && attempt.qrCodeUrl ? <img src={attempt.qrCodeUrl} alt="QRIS pembayaran Midtrans" className="mx-auto mt-5 size-56 rounded-lg border border-slate-200 object-contain" /> : null;
  const primary = uiState === "paid" ? <Link href={`/pesanan/${order.id}/serah-terima`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"><CheckCircle2 className="size-4" />Lihat kode pengambilan</Link> : uiState === "checkout_ready" || uiState === "checkout_created" || uiState === "awaiting_payment" || uiState === "retryable_failure" ? <button type="button" onClick={() => void (uiState === "awaiting_payment" || uiState === "checkout_created" ? charge() : charge())} disabled={busy || order.phase !== "payment_open" || snapState === "loading" || snapState === "blocked"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><CreditCard className="size-4" />{busy ? "Memproses…" : snapState === "loading" ? "Menyiapkan checkout…" : uiState === "checkout_created" || uiState === "awaiting_payment" ? "Lanjutkan pembayaran" : "Pilih metode pembayaran"}</button> : null;
  const showDirectFallback = Boolean(redirectUrl && (paymentError || snapState === "error" || snapState === "blocked"));

  return <div className="space-y-5">
    {snapConfig && <MidtransSnapLoader orderId={order.id} config={snapConfig} onStateChange={handleSnapState} onRecoveryExhausted={handleSnapRecoveryExhausted} />}
    <PaymentWindowHeader order={order} countdown={countdown} deadline={deadline} onRetry={onReload} />
    <InvoiceCard order={order} amount={amount} />
    <section aria-label="Status pembayaran Midtrans" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className={`mt-0.5 rounded-full p-2 ${uiState === "paid" ? "bg-emerald-100 text-emerald-600" : uiState === "expired" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>{uiState === "paid" ? <CheckCircle2 className="size-5" /> : uiState === "expired" ? <XCircle className="size-5" /> : <CreditCard className="size-5" />}</div><div className="min-w-0 flex-1"><h2 className="text-base font-bold text-slate-900">{copy.title}</h2><p className="mt-1 text-sm text-slate-600">{copy.description}</p>{legacyQr}{method && <p className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Metode dipilih: {method}</p>}{amount !== null && <p className="mt-3 text-xl font-extrabold text-slate-900">{money.format(amount)}</p>}</div></div><div className="mt-5 flex flex-wrap gap-2">{primary}{attempt && order.status === "pending_payment" && uiState !== "expired" && <button type="button" disabled={busy} onClick={() => void reconcile()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className="size-4" />{busy && lastAction === "reconcile" ? "Memeriksa…" : "Cek status"}</button>}</div>{(message || paymentError) && <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><p>{paymentError?.message ?? message}</p>{paymentError?.requestId && <p className="mt-1 font-mono text-[10px]">Referensi: {paymentError.requestId}</p>}{paymentError && <button type="button" onClick={retry} disabled={busy} className="mt-2 inline-flex items-center gap-1 rounded-md border border-current px-2 py-1 text-xs font-semibold disabled:opacity-50"><RefreshCw className="size-3" />Coba lagi</button>}</div>}{showDirectFallback && <button type="button" onClick={openRedirect} disabled={busy} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-700"><CreditCard className="size-4" />Buka checkout langsung</button>}</section>
  </div>;
}
