"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/SkeletonLoading";
import type { SupplierDashboardResponse } from "@/lib/supplier-catalog/dashboard-repository";

export default function SupplierOrdersOverviewClient() {
  const [dashboard, setDashboard] = useState<SupplierDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/suppliers/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Pesanan Supplier belum dapat dimuat.");
        if (!cancelled) setDashboard(body as SupplierDashboardResponse);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Pesanan Supplier belum dapat dimuat.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="space-y-3" role="status" aria-live="polite"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  const batches = dashboard?.recentBatches ?? [];
  if (batches.length === 0) return <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><Package aria-hidden="true" className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 text-lg font-bold text-slate-900">Belum ada batch Supplier</h2><p className="mt-1 text-sm text-slate-600">Buat katalog terlebih dahulu untuk melihat pesanan dan pengambilan.</p><Link href="/supplier/catalog/new" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Buat Penawaran<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></section>;

  return <section aria-label="Batch dengan pesanan Supplier" className="space-y-3">{batches.map((batch) => <article key={batch.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-bold text-slate-900">{batch.title}</h2><p className="mt-1 text-sm text-slate-500">{batch.participantCount} peserta · {batch.registeredQuantity} unit terdaftar</p></div><div className="flex flex-wrap gap-2"><Link href={`/supplier/batch/${batch.id}/orders`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"><ClipboardList className="h-4 w-4" aria-hidden="true" />Pesanan</Link><Link href={`/supplier/batch/${batch.id}/pickup`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Pengambilan<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div></div></article>)}</section>;
}
