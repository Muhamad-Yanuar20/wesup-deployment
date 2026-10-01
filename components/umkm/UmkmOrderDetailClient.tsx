"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, MapPin, QrCode, RefreshCw, ShieldAlert, ShieldCheck, Star, Upload } from "lucide-react";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import PickupQrBlock from "@/components/orders/PickupQrBlock";
import { compressImage } from "@/lib/image-compression";
import type { MidtransSnapConfig } from "@/components/payments/MidtransSnapLoader";
import UmkmPaymentPanel from "@/components/payments/UmkmPaymentPanel";

import { Alert, AsyncButton, ContentSkeleton, ErrorState, Progress, SuccessState } from "@/components/feedback";
import { feedbackError } from "@/lib/feedback/errors";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

import TransactionOverview from "@/components/orders/TransactionOverview";

export type UmkmOrderDetailMode = "overview" | "payment" | "pickup" | "complaint" | "dispute" | "rating" | "refund";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const statusLabel: Record<string, string> = { registered: "Terdaftar", pending_payment: "Menunggu Bayar", paid: "Lunas", picked_up: "Sudah Diambil", completed: "Selesai", no_show: "Tidak Hadir", cancelled: "Dibatalkan", refund_pending: "Proses Refund", refunded: "Refund Selesai" };

function formatDate(value: string | null | undefined): string { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed); }
function apiError(body: unknown, fallback: string): string { return body && typeof body === "object" && "error" in body ? feedbackError((body as { error?: unknown }).error, fallback) : fallback; }

function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<UmkmOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoaded = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++generation.current;
    const initialLoad = !hasLoaded.current;
    if (initialLoad) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/umkm/orders/${encodeURIComponent(orderId)}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Pesanan belum dapat dimuat."));
      if (signal?.aborted || current !== generation.current) return;
      setOrder(body as UmkmOrderDetail);
      hasLoaded.current = true;
    } catch (reason: unknown) {
      if (signal?.aborted || current !== generation.current || (reason instanceof Error && reason.name === "AbortError")) return;
      setError(feedbackError(reason, "Pesanan belum dapat dimuat."));
    } finally { if (initialLoad && !signal?.aborted && current === generation.current) setLoading(false); }
  }, [orderId]);
  useEffect(() => {
    hasLoaded.current = false;
    const counter = generation;
    const controller = new AbortController();
    const task = window.setTimeout(() => { void load(controller.signal); }, 0);
    const poll=window.setInterval(()=>{if(document.visibilityState==='visible')void load(controller.signal);},30_000);
    return () => { window.clearTimeout(task);window.clearInterval(poll); counter.current++; controller.abort(); };
  }, [load]);
  const reload = useCallback(() => { void load(); }, [load]);
  return { order, loading, error, reload };
}

function PageHeader({ order, mode }: { order: UmkmOrderDetail; mode: UmkmOrderDetailMode }) {
  const labels: Record<UmkmOrderDetailMode, string> = { overview:"Detail pesanan", payment: "Pembayaran Tagihan", pickup: "Serah Terima", complaint: "Ajukan Komplain", dispute: "Lacak Sengketa", rating: "Penilaian & Ulasan", refund: "Rekening Refund" };
  return <><nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm"><Link href="/umkm/pesanan" className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" aria-hidden="true" />Pesanan</Link><span className="text-slate-300" aria-hidden="true">/</span><span className="truncate text-slate-500">{labels[mode]}</span></nav><header><h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">{order.batchTitle}</h1><p className="mt-1 text-sm text-slate-500">{order.supplierName} · <span className="font-mono">{order.batchDisplayCode}</span> · {order.quantity} {order.unit}</p></header></>;
}

function Summary({ order }: { order: UmkmOrderDetail }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-700">Ringkasan Pesanan</header><dl className="grid grid-cols-2 gap-4 px-5 py-4 text-sm sm:grid-cols-4"><div><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1 font-semibold text-slate-900">{statusLabel[order.status] ?? order.status}</dd></div><div><dt className="text-xs text-slate-500">Kuantitas</dt><dd className="mt-1 font-semibold text-slate-900">{order.quantity} {order.unit}</dd></div><div><dt className="text-xs text-slate-500">Tier terkunci</dt><dd className="mt-1 font-semibold text-slate-900">{order.lockedTier === null ? "Belum dikunci" : `Harga ${order.lockedTier}`}</dd></div><div><dt className="text-xs text-slate-500">Total tagihan</dt><dd className="mt-1 font-semibold text-slate-900">{order.finalAmount === null ? "Belum ditentukan" : money.format(order.finalAmount)}</dd></div></dl></section>;
}

function PickupPanel({ order }: { order: UmkmOrderDetail }) {
  const [pickup, setPickup] = useState(order.pickup);
  const [message, setMessage] = useState("");
  const generating = useRef(false);
  const [request, setRequest] = useState(0), [pending, setPending] = useState(false);
  useEffect(() => {
    if (!order.capabilities.canViewPickup || pickup?.qrCodeToken || pickup?.usedAt) return;
    let active = true; generating.current = true; queueMicrotask(() => { if (active) { setPending(true); setMessage(""); } });
    void fetch(`/api/pickups/${order.id}/code`, { method: "POST" }).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Kode pengambilan belum dapat dimuat."));
      if (active) setPickup({ qrCodeToken: body.qrCodeToken, pinCode: body.pinCode, generatedAt: new Date().toISOString(), usedAt: null, address: order.pickup?.address ?? null });
    }).catch(reason => { if (active) setMessage(feedbackError(reason, "Kode pengambilan belum dapat dimuat.")); })
      .finally(() => { generating.current = false; if (active) setPending(false); });
    return () => { active = false; };
  }, [order.id, order.capabilities.canViewPickup, order.pickup?.address, pickup?.qrCodeToken, pickup?.usedAt, request]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 3000); return () => window.clearTimeout(timer); }, [copied]);
  const copy = async () => { if (!pickup?.pinCode) return; try { await navigator.clipboard.writeText(pickup.pinCode); setCopied(true); } catch { setMessage("PIN belum tersalin. Anda tetap bisa menunjukkan PIN di layar."); } };
  if (!order.capabilities.canViewPickup) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">{order.presentation?.blockedReason ?? "Kode QR dan PIN tersedia setelah pembayaran lunas."}</section>;
  const deadline = order.timeline.pickupDeadlineAt;
  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold"><QrCode className="size-5 text-blue-600" />Kode QR Pengambilan</h2><p className="mt-1 text-xs text-slate-500">Perlihatkan kode ini ke Supplier saat tiba di titik kumpul.</p>{pickup?.qrCodeToken ? <div className="mt-4"><PickupQrBlock seed={pickup.qrCodeToken} /></div> : pending ? <ContentSkeleton variant="detail" label="Menyiapkan kode pengambilan…" /> : <ErrorState title="Kode belum dapat dimuat." description={message || "Coba periksa kode pengambilan kembali."} action={<AsyncButton onClick={() => setRequest(value => value + 1)}>Coba lagi</AsyncButton>} />}</section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-blue-600" />PIN 4-digit Cadangan</h2><p className="mt-1 text-xs text-slate-500">Gunakan jika kamera Supplier bermasalah.</p>{pickup?.pinCode ? <><div className="mt-5 grid grid-cols-4 gap-2">{pickup.pinCode.split("").map((digit, index) => <span key={`${digit}-${index}`} className="rounded-lg border border-slate-300 bg-slate-50 py-3 text-center font-mono text-2xl font-black">{digit}</span>)}</div><button type="button" onClick={() => void copy()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">{copied ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Copy className="size-4" />}{copied ? "PIN tersalin" : "Salin PIN"}</button></> : <p className="mt-5 text-sm text-slate-500">PIN belum tersedia.</p>}</section></div><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-5 text-blue-600" />Lokasi & Jendela Pengambilan</h2><p className="mt-2 text-sm text-slate-700">{pickup?.address ?? "Alamat pickup tersedia di detail batch."}</p><p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">Estimasi siap: <strong>{formatDate(order.timeline.estimatedReadyAt)}</strong>. Batas toleransi: <strong>{formatDate(deadline)}</strong> {order.policyVersion === 2 ? "Waktu sesuai komitmen pengambilan Anda." : "(12 jam). Lewat batas memicu No-Show."}</p>{order.pickupConfirmedAt && <p className="mt-3 text-xs text-emerald-700">Dikonfirmasi pada {formatDate(order.pickupConfirmedAt)}. Komplain terbuka sampai {formatDate(order.timeline.complaintDeadlineAt)}.</p>}</section>{message && pickup?.qrCodeToken && <p role="status" className="text-sm text-slate-600">{message}</p>}<Summary order={order} /></div>;
}

function ComplaintPanel({ order }: { order: UmkmOrderDetail }) {
  const [category, setCategory] = useState<"cacat" | "busuk">("cacat"); const [description, setDescription] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [prepared, setPrepared] = useState<number | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (files.length < 1) { setMessage("Unggah minimal satu foto bukti."); return; } setBusy(true); setMessage(""); setPrepared(0); try { const compressed: File[] = []; for (const [index, file] of files.entries()) { setMessage(`Mengompresi foto ${index + 1} dari ${files.length}…`); try { const result = await compressImage(file, { outputType: "image/webp" }); compressed.push(new File([result.blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" })); } catch { compressed.push(file); } setPrepared(index + 1); } const form = new FormData(); form.set("category", category); form.set("description", description); compressed.forEach((file) => form.append("photos", file)); setMessage("Mengirim komplain…"); const response = await fetch(`/api/umkm/orders/${order.id}/complaints`, { method: "POST", body: form }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Komplain belum dapat diajukan.")); window.location.assign(`/pesanan/${order.id}/sengketa`); } catch (reason: unknown) { setMessage(feedbackError(reason, "Hasil pengiriman belum terkonfirmasi. Periksa detail pesanan sebelum mengirim ulang; bukti Anda tetap tersedia.")); } finally { setBusy(false); setPrepared(null); } };
  if (!order.capabilities.canComplain) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"><ShieldAlert className="mr-2 inline size-4" />Jendela komplain belum terbuka atau sudah ditutup.</section>;
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-bold text-slate-800">Jenis Komplain</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["cacat", "busuk"] as const).map((value) => <label key={value} className={`cursor-pointer rounded-lg border p-4 ${category === value ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input type="radio" name="category" value={value} checked={category === value} onChange={() => setCategory(value)} className="mr-2" />Barang {value}</label>)}</div></div><label className="block text-sm font-semibold text-slate-700">Deskripsi kondisi (opsional)<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2_000} rows={4} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Ceritakan kondisi barang saat diterima." /></label><label className="block rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600"><Upload className="mx-auto mb-2 size-6 text-blue-500" /><span className="font-semibold">Unggah bukti foto</span><span className="mt-1 block text-xs text-slate-400">JPEG, PNG, atau WebP · 1–5 foto · kompresi otomatis</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="mx-auto mt-3 block max-w-full text-xs" /></label>{busy && prepared !== null && <Progress value={prepared} max={files.length} label="Menyiapkan foto" />}{message && <p role="alert" className="text-sm text-red-600">{message}</p>}<AsyncButton type="submit" pending={busy} pendingLabel={prepared !== null ? "Menyiapkan foto…" : "Mengirim komplain…"} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? "Memproses…" : "Ajukan Komplain & Bekukan Dana"}</AsyncButton></form>;
}

function DisputePanel({ order }: { order: UmkmOrderDetail }) {
  if (!order.dispute) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">Belum ada sengketa untuk pesanan ini.</section>;
  const winningUmkm = order.dispute.status === "resolved_umkm";
  return <div className="space-y-5"><section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><ShieldAlert className="mr-2 inline size-5" />{order.dispute.decidedAt ? "Keputusan Admin tersedia. Status dana mengikuti hasil pemeriksaan." : "Komplain sedang ditinjau Admin. Dana dibekukan selama pemeriksaan."}</section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold uppercase tracking-wide text-slate-700">Perjalanan Sengketa</h2><ol className="mt-5 space-y-5 border-l-2 border-slate-200 pl-5 text-sm"><li><strong className="text-emerald-700">Komplain diajukan</strong><p className="text-xs text-slate-500">Kategori: {order.dispute.complaintCategory}. {formatDate(order.dispute.createdAt)}</p></li><li><strong className="text-blue-700">Ditinjau Arbiter</strong><p className="text-xs text-slate-500">Admin meninjau bukti foto dan kronologi.</p></li><li><strong className={winningUmkm ? "text-emerald-700" : "text-slate-500"}>Keputusan</strong><p className="text-xs text-slate-500">{order.dispute.decidedAt ? formatDate(order.dispute.decidedAt) : "Menunggu keputusan final."}</p></li></ol></section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold uppercase tracking-wide text-slate-700">Bukti Komplain</h2><p className="mt-3 text-sm text-slate-600">{order.dispute.description || "Tidak ada deskripsi tambahan."}</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{order.dispute.photoUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-3 text-center text-xs text-blue-700">Lihat foto</a>)}</div></section>{winningUmkm && order.capabilities.canSubmitRefundAccount && <Link href={`/pesanan/${order.id}/refund/rekening`} className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Isi rekening refund</Link>}</div>;
}

function RatingPanel({ order, onReload }: { order: UmkmOrderDetail; onReload: () => void }) {
  const [succeeded, setSucceeded] = useState(false);
  const [score, setScore] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  if (succeeded) return <SuccessState title="Ulasan tersimpan." description="Terima kasih sudah menilai pesanan ini." />;
  if (order.rating) return <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><Star className="mr-2 inline size-4" />Anda sudah memberi rating {order.rating.score}/5 pada {formatDate(order.rating.createdAt)}.</section>;
  if (!order.capabilities.canRate) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">Rating tersedia setelah serah terima selesai dan tidak berlaku untuk No-Show.</section>;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!score) { setMessage("Pilih rating bintang terlebih dahulu."); return; } setBusy(true); setMessage(""); try { const response = await fetch(`/api/umkm/orders/${order.id}/ratings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score, comment: comment || null }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Rating belum dapat dikirim.")); setSucceeded(true); onReload(); } catch (reason: unknown) { setMessage(feedbackError(reason, "Hasil pengiriman ulasan belum terkonfirmasi. Periksa detail sebelum mengirim ulang.")); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-bold uppercase tracking-wide text-slate-700">Berikan Rating Bintang</h2><p className="mt-1 text-xs text-slate-500">Bagaimana kualitas layanan {order.supplierName}?</p><div className="mt-4 flex gap-2" role="radiogroup" aria-label="Rating bintang">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} bintang`} aria-pressed={score === value} onClick={() => setScore(value)} className={value <= score ? "text-amber-400" : "text-slate-300"}><Star className="size-8 fill-current" /></button>)}</div></div><label className="block text-sm font-semibold text-slate-700">Ulasan (opsional)<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={1_000} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>{message && <p role="alert" className="text-sm text-red-600">{message}</p>}<AsyncButton type="submit" pending={busy} pendingLabel="Mengirim ulasan…" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? "Mengirim…" : "Kirim Penilaian"}</AsyncButton></form>;
}

function RefundPanel({ order, onReload }: { order: UmkmOrderDetail; onReload: () => void }) {
  const [confirm, setConfirm] = useState(false), [saved, setSaved] = useState(false);
  const [bankName, setBankName] = useState(""); const [accountNumber, setAccountNumber] = useState(""); const [accountHolderName, setAccountHolderName] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  if (!order.capabilities.canSubmitRefundAccount && !order.refund) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">Rekening refund hanya dapat diisi ketika pesanan memiliki tiket refund.</section>;
  const save = async () => { if (busy) return; setBusy(true); setMessage(""); try { const response = await fetch(`/api/umkm/orders/${order.id}/refund-account`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankName, accountNumber, accountHolderName }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Rekening refund belum dapat disimpan.")); setSaved(true); setConfirm(false); onReload(); } catch (reason: unknown) { setMessage(feedbackError(reason, "Rekening refund belum dapat disimpan. Isian Anda tetap tersedia.")); } finally { setBusy(false); } };
  if (saved) return <SuccessState title="Rekening pengembalian dana tersimpan." description="Pengembalian dana mengikuti status server. Penyimpanan rekening belum berarti dana telah ditransfer." />;
  return <form onSubmit={event => { event.preventDefault(); setMessage(""); if (order.refund?.bankAccountId) setConfirm(true); else void save(); }} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold uppercase tracking-wide text-slate-700">Rekening Pengembalian Dana</h2><p className="text-sm text-slate-600">Transfer refund dilakukan manual oleh Admin setelah rekening terverifikasi.</p><label className="block text-sm font-semibold">Nama bank<input required value={bankName} onChange={(event) => setBankName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label><label className="block text-sm font-semibold">Nomor rekening<input required inputMode="numeric" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label><label className="block text-sm font-semibold">Nama pemilik rekening<input required value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>{message && !confirm && <p role="alert" className="text-sm text-red-600">{message}</p>}<AsyncButton type="submit" pending={busy} pendingLabel="Menyimpan rekening…" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{busy ? "Menyimpan…" : "Simpan Rekening"}</AsyncButton><ConfirmDialog open={confirm} title="Ganti rekening pengembalian dana?" description={`${bankName} · ${accountNumber} · ${accountHolderName}. Pastikan penerima sudah benar sebelum menyimpan.`} pending={busy} error={message} onConfirm={() => void save()} onCancel={() => setConfirm(false)} /></form>;
}

export default function UmkmOrderDetailClient({ orderId, mode, snapConfig }: { orderId: string; mode: UmkmOrderDetailMode; snapConfig?: MidtransSnapConfig }) {
  const { order, loading, error, reload } = useOrderDetail(orderId);
  if (loading) return <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Memuat detail pesanan…</div>;
  if ((error && !order) || !order) return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Pesanan tidak ditemukan."}<button type="button" onClick={reload} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white"><RefreshCw className="size-4" />Coba lagi</button></section>;
  return <div className="mx-auto w-full max-w-4xl space-y-6"><PageHeader order={order} mode={mode} />{error && <Alert tone="warning" action={<AsyncButton onClick={reload}>Coba lagi</AsyncButton>}>Detail terakhir ditampilkan; pembaruan belum berhasil.</Alert>}{mode === "overview" && <TransactionOverview order={order} onReload={reload}>{!order.invoice && <Summary order={order}/>} {(order.invoice || ["waiting_payment_window","payment_open","payment_verifying","payment_expired"].includes(order.phase)) && <UmkmPaymentPanel order={order} onReload={reload} snapConfig={snapConfig}/>} {order.phase === "ready_for_pickup" && <PickupPanel order={order}/>} {order.capabilities.canSubmitRefundAccount && <RefundPanel order={order} onReload={reload}/>} {order.capabilities.canTrackDispute && <DisputePanel order={order}/>} {(order.capabilities.canComplain || order.capabilities.canRate) && <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Periksa barang, ulasan, dan komplain</summary>{order.capabilities.canComplain && <ComplaintPanel order={order}/>} {order.capabilities.canRate && <RatingPanel order={order} onReload={reload}/>}</details>}</TransactionOverview>}{mode === "payment" && <UmkmPaymentPanel order={order} onReload={reload} snapConfig={snapConfig} />}{mode === "pickup" && <PickupPanel order={order} />}{mode === "complaint" && <><Summary order={order} /><ComplaintPanel order={order} /></>}{mode === "dispute" && <><Summary order={order} /><DisputePanel order={order} /></>}{mode === "rating" && <><Summary order={order} /><RatingPanel order={order} onReload={reload} /></>}{mode === "refund" && <><Summary order={order} /><RefundPanel order={order} onReload={reload} /></>}</div>;
}
