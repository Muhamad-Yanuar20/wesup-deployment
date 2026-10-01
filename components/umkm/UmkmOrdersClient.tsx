"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, RefreshCw, ShoppingBag, Star, WalletCards } from "lucide-react";
import PaymentPageLink from "@/components/payments/PaymentPageLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/SkeletonLoading";
import type { OrderCapabilities, OrderSummary, UmkmOrderListItem } from "@/lib/orders/api-types";

import { feedbackError } from "@/lib/feedback/errors";

type FilterKey = "needs_action" | "ongoing" | "completed" | "all" | "pending_payment" | "paid" | "picked_up" | "registered" | "no_show" | "cancelled" | "refund";
type ClientOrder = UmkmOrderListItem & { batchStatus?: string | null };

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const FILTERS: Array<{key:FilterKey;label:string}>=[{key:"all",label:"Semua"},{key:"needs_action",label:"Perlu tindakan"},{key:"ongoing",label:"Berlangsung"},{key:"completed",label:"Selesai"},{key:"cancelled",label:"Dibatalkan"}];

const statusStyle: Record<string, { label: string; className: string }> = {
  registered: { label: "Terdaftar", className: "bg-slate-100 text-slate-700" },
  pending_payment: { label: "Menunggu Bayar", className: "bg-amber-100 text-amber-700" },
  paid: { label: "Lunas", className: "bg-blue-100 text-blue-700" },
  picked_up: { label: "Sudah Diambil", className: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Selesai", className: "bg-emerald-100 text-emerald-700" },
  no_show: { label: "Tidak Hadir", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Dibatalkan", className: "bg-slate-100 text-slate-600" },
  refund_pending: { label: "Proses Refund", className: "bg-orange-100 text-orange-700" },
  refunded: { label: "Refund Selesai", className: "bg-teal-100 text-teal-700" },
};

const EMPTY_SUMMARY: OrderSummary = { total: 0, pendingPayment: 0, paidReady: 0, pickedUp: 0, refund: 0 };

function capabilitiesFor(order: ClientOrder): OrderCapabilities {
  return order.capabilities ?? {
    canPay: order.status === "pending_payment" && order.phase === "payment_open",
    canViewPickup: order.status === "paid" || order.status === "picked_up" || order.status === "completed",
    canComplain: order.status === "picked_up",
    canTrackDispute: false,
    canRate: order.status === "picked_up" || order.status === "completed",
    canSubmitRefundAccount: order.status === "refund_pending",
  };
}

function filterMatches(order: ClientOrder, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if(["needs_action","ongoing","completed","cancelled"].includes(filter)&&order.presentation)return order.presentation.group===filter;
  if (filter === "picked_up") return order.status === "picked_up" || order.status === "completed";
  if (filter === "refund") return order.status === "refund_pending" || order.status === "refunded";
  return order.status === filter;
}

function StatusBadge({ status }: { status: string }) {
  const style = statusStyle[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}><span className="mr-1.5 size-1.5 rounded-full bg-current" aria-hidden="true" />{style.label}</span>;
}

function ActionLinks({ order }: { order: ClientOrder }) {
  if(order.presentation)return <Link href={`/umkm/pesanan/${order.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">{order.presentation.primaryAction.label}</Link>;
  const capabilities = capabilitiesFor(order);
  if (capabilities.canPay) return <PaymentPageLink href={`/pesanan/${order.id}/bayar`} className="inline-flex min-h-9 items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Bayar Sekarang</PaymentPageLink>;
  if (capabilities.canViewPickup && (order.status === "paid" || order.phase === "ready_for_pickup")) return <Link href={`/pesanan/${order.id}/serah-terima`} className="inline-flex min-h-9 items-center rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Serah Terima</Link>;
  if (capabilities.canTrackDispute) return <Link href={`/pesanan/${order.id}/sengketa`} className="inline-flex min-h-9 items-center rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100">Lacak Sengketa</Link>;
  if (capabilities.canComplain) return <Link href={`/pesanan/${order.id}/komplain`} className="inline-flex min-h-9 items-center rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Ajukan Komplain</Link>;
  if (capabilities.canRate) return <Link href={`/pesanan/${order.id}/nilai`} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"><Star className="size-3.5" aria-hidden="true" />Nilai & Ulas</Link>;
  if (capabilities.canSubmitRefundAccount) return <Link href={`/pesanan/${order.id}/refund/rekening`} className="inline-flex min-h-9 items-center rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100">Isi Rekening Refund</Link>;
  return <span className="text-xs text-slate-300">—</span>;
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}>{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p></div></div>;
}

export default function UmkmOrdersClient() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [summary, setSummary] = useState<OrderSummary>(EMPTY_SUMMARY);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorRequestId, setErrorRequestId] = useState("");
  const [retry, setRetry] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [nextCursor,setNextCursor]=useState<string|null>(null);

  const load = useCallback(async (signal: AbortSignal,cursor?:string) => {
    setLoading(true);
    setError("");
    setErrorRequestId("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if(cursor) params.set("cursor",cursor);
      if (filter !== "all") params.set("group", filter);
      const response = await fetch(`/api/umkm/orders?${params.toString()}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorRequestId(typeof body.requestId === "string" ? body.requestId : "");
        throw new Error(body.error ?? "Pesanan belum dapat dimuat.");
      }
      if (signal.aborted) return;
      const rawOrders = Array.isArray(body.items) ? body.items : Array.isArray(body.orders) ? body.orders : [];
      setOrders(previous=>cursor?[...previous,...rawOrders.filter((row:ClientOrder)=>!previous.some(item=>item.id===row.id))]:rawOrders as ClientOrder[]);
      setNextCursor(typeof body.nextCursor==='string'?body.nextCursor:null);
      setSummary(body.summary ?? EMPTY_SUMMARY);
      setCounts(body.counts ?? {});
    } catch (reason: unknown) {
      if (signal.aborted || (reason instanceof Error && reason.name === "AbortError")) return;
      setError(feedbackError(reason, "Pesanan belum dapat dimuat."));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(task); controller.abort(); };
  }, [load, retry]);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 767px)");
    if (!media) return;
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const visibleOrders = useMemo(() => orders.filter((order) => filterMatches(order, filter)), [orders, filter]);
  const countFor = (key: FilterKey) => key === "cancelled" ? (counts.cancelled_group ?? counts.cancelled ?? 0) : key === "all" ? (counts.all ?? summary.total ?? orders.length) : key === "picked_up" ? (counts.picked_up ?? summary.pickedUp) : key === "refund" ? (counts.refund ?? summary.refund) : (counts[key] ?? orders.filter((order) => filterMatches(order, key)).length);

  if (loading && orders.length === 0) return <div className="space-y-4" role="status" aria-label="Memuat pesanan"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}</div><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  if (error && orders.length === 0) return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p>{error}</p>{errorRequestId && <p className="mt-2 text-xs text-red-600">Referensi: {errorRequestId}</p>}<button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700"><RefreshCw className="size-4" aria-hidden="true" />Coba lagi</button></section>;
  if (!loading && visibleOrders.length === 0 && filter === "all") return <section className="rounded-xl border border-dashed border-slate-300 bg-white"><EmptyState heading="Belum ada pesanan" description="Pesanan yang Anda ikuti akan muncul di sini setelah Join Batch berhasil." action={<Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Jelajahi Marketplace<ArrowRight className="size-4" aria-hidden="true" /></Link>} /></section>;

  return <section aria-label="Daftar pesanan UMKM" className="space-y-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard icon={<ShoppingBag className="size-5 text-indigo-600" />} label="Total Pesanan" value={summary.total || countFor("all")} tone="bg-indigo-100" />
      <SummaryCard icon={<Clock3 className="size-5 text-amber-600" />} label="Menunggu Bayar" value={summary.pendingPayment || countFor("pending_payment")} tone="bg-amber-100" />
      <SummaryCard icon={<CheckCircle2 className="size-5 text-blue-600" />} label="Lunas" value={summary.paidReady || countFor("paid")} tone="bg-blue-100" />
      <SummaryCard icon={<PackageCheck className="size-5 text-emerald-600" />} label="Sudah Diambil" value={summary.pickedUp || countFor("picked_up")} tone="bg-emerald-100" />
    </div>
    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm" role="tablist" aria-label="Filter status pesanan">
      {FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === item.key ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item.label} <span className="ml-1 opacity-70">({countFor(item.key)})</span></button>)}
    </div>
    {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {!isMobile && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Mitra</th><th className="px-4 py-3 font-medium">Qty</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleOrders.map((order) => <tr key={order.id} className="align-middle"><td className="px-4 py-3"><PaymentPageLink href={`/umkm/pesanan/${order.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{order.batchTitle}</PaymentPageLink><p className="mt-1 text-[11px] text-slate-400">{order.batchDisplayCode}</p></td><td className="px-4 py-3 text-xs text-slate-600">{order.supplierName ?? "Supplier"}</td><td className="px-4 py-3 font-semibold text-slate-700">{order.quantity} {order.unit}</td><td className="px-4 py-3 font-semibold text-slate-800">{order.finalAmount === null || order.finalAmount === undefined ? "Belum ditentukan" : money.format(order.finalAmount)}</td><td className="px-4 py-3"><StatusBadge status={order.presentation?.label??order.status} /></td><td className="px-4 py-3 text-right"><ActionLinks order={order} /></td></tr>)}</tbody></table></div>}
      {isMobile && <div className="divide-y divide-slate-100">{visibleOrders.map((order) => <article key={order.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><PaymentPageLink href={`/umkm/pesanan/${order.id}`} className="font-semibold text-slate-900">{order.batchTitle}</PaymentPageLink><p className="mt-1 text-xs text-slate-500">{order.quantity} {order.unit} · {order.supplierName ?? "Supplier"}</p></div><StatusBadge status={order.presentation?.label??order.status} /></div><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Total <strong className="text-slate-900">{order.finalAmount === null || order.finalAmount === undefined ? "—" : money.format(order.finalAmount)}</strong></span><ActionLinks order={order} /></div></article>)}</div>}
    </div>
    {!loading && visibleOrders.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Tidak ada pesanan pada filter “{FILTERS.find((item) => item.key === filter)?.label}”.</p>}
    {nextCursor&&<button type="button" disabled={loading} onClick={()=>{void load(new AbortController().signal,nextCursor);}} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold">Muat pesanan berikutnya</button>}
    {loading && <p className="text-center text-xs text-slate-400">Memperbarui pesanan…</p>}
    <div className="flex items-center justify-end gap-2 text-xs text-slate-500"><WalletCards className="size-4" aria-hidden="true" />Nominal dan hak aksi ditentukan server.</div>
  </section>;
}
