"use client";

import Link from "@/components/supplier/fulfillment/FulfillmentLink";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";
import { ArrowDisc, ErrorState, Skeleton } from "@/components/feedback";
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

  if (loading)
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Memuat pesanan supplier</span>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  if (error) return <ErrorState title="Pesanan Supplier belum dapat dimuat." description={error} />;

  const batches = dashboard?.recentBatches ?? [];
  if (batches.length === 0)
    return (
      <section className="border border-wesup-ink/15 bg-wesup-paper px-5 py-10 text-center">
        <span aria-hidden="true" className="mx-auto mb-5 block h-px w-10 bg-wesup-ink/25" />
        <span aria-hidden="true" className="mx-auto mb-4 flex size-10 items-center justify-center border border-wesup-ink/20 text-wesup-ink-sub">
          <span className="font-mono text-lg leading-none">0</span>
        </span>
        <h2 className="wesup-state-title text-2xl leading-[0.98] tracking-[0.06em] text-wesup-ink sm:text-3xl">
          Belum ada batch Supplier
        </h2>
        <p className="mx-auto mt-3 max-w-prose text-sm leading-6 text-wesup-ink-sub">
          Buat katalog terlebih dahulu untuk melihat pesanan dan pengambilan.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            href="/supplier/catalog/new"
            className="group inline-flex min-h-12 items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-7 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
          >
            Buat Penawaran
            <ArrowDisc />
          </Link>
        </div>
      </section>
    );

  return (
    <section aria-label="Batch dengan pesanan Supplier" className="space-y-3">
      {batches.map((batch) => (
        <article key={batch.id} className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                <span className="tabular-nums">{batch.displayCode}</span>
              </p>
              <h2 className="truncate text-base font-semibold text-wesup-ink">{batch.title}</h2>
              <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                <span className="tabular-nums">{batch.participantCount}</span> peserta ·{" "}
                <span className="tabular-nums">{batch.registeredQuantity}</span> unit terdaftar ·{" "}
                <span className="tabular-nums">{batch.paidParticipantCount}</span> bayar
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/supplier/batch/${batch.id}/orders`}
                className="group inline-flex min-h-11 items-center justify-center gap-2 border border-wesup-ink bg-wesup-ink px-5 py-2.5 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              >
                <ClipboardList className="size-4" aria-hidden="true" strokeWidth={1.5} />
                Pesanan
              </Link>
              <Link
                href={`/supplier/batch/${batch.id}/pickup`}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-wesup-ink bg-transparent px-5 py-2.5 text-sm font-semibold text-wesup-ink transition-colors duration-300 wesup-ease hover:bg-wesup-ink hover:text-wesup-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              >
                Pengambilan
                <ArrowRight className="size-4" aria-hidden="true" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
