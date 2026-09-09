"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/SkeletonLoading";

interface UmkmOrder { id: string; batchId: string; batchTitle: string; batchStatus: string | null; quantity: number; status: string; finalAmount: number | null; lockedTier: number | null; createdAt: string; }
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const statusLabels: Record<string, string> = { registered: "Terdaftar", pending_payment: "Menunggu bayar", paid: "Lunas", picked_up: "Sudah diambil", completed: "Selesai", no_show: "Tidak hadir", cancelled: "Dibatalkan", refunded: "Dikembalikan", refund_pending: "Proses pengembalian" };

export default function UmkmOrdersClient() {
  const [orders, setOrders] = useState<UmkmOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/umkm/orders", { cache: "no-store" }).then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "Pesanan belum dapat dimuat."); if (!cancelled) setOrders(body.orders ?? []); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Pesanan belum dapat dimuat."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  if (loading) return <div className="space-y-3" role="status"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (orders.length === 0) return <section className="rounded-xl border border-dashed border-slate-300 bg-white"><EmptyState heading="Belum ada pesanan" description="Pesanan yang Anda ikuti akan muncul di sini setelah Join Batch berhasil." action={<Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Jelajahi Marketplace<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>} /></section>;
  return <section aria-label="Daftar pesanan UMKM" className="space-y-3">{orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">{order.batchTitle}</h2><p className="mt-1 text-xs text-slate-500">{order.quantity} porsi{order.lockedTier ? ` • Tier ${order.lockedTier}` : ""}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[order.status] ?? order.status}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-slate-600">Total: <strong className="text-slate-900">{order.finalAmount === null ? "Belum ditentukan" : money.format(order.finalAmount)}</strong></span><Link href={`/marketplace/${order.batchId}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Lihat batch<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div></article>)}</section>;
}
