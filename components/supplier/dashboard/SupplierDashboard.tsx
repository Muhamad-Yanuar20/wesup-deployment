"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { ArrowDisc, ErrorState, AsyncButton, Skeleton } from "@/components/feedback";
import {
  supplierDashboardRepository,
  type SupplierDashboardResponse,
} from "@/lib/supplier-catalog/dashboard-repository";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatRating(average: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

function progressFor(registered: number, target: number): number {
  return target <= 0 ? 0 : Math.min(100, Math.max(0, (registered / target) * 100));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PUBLISHED: "Aktif",
    CLOSED: "Ditutup",
    CANCELLED_BY_SUPPLIER: "Dibatalkan",
    TAKEDOWN: "Diturunkan",
    COMPLETED: "Selesai",
  };
  return labels[status] ?? status;
}

function isAlertStatus(status: string): boolean {
  return status === "CANCELLED_BY_SUPPLIER" || status === "TAKEDOWN";
}

function StatusChip({ status }: { status: string }) {
  if (isAlertStatus(status)) {
    return (
      <span className="bg-wesup-red px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper">
        {statusLabel(status)}
      </span>
    );
  }
  return (
    <span className="bg-wesup-paper-sub px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink">
      {statusLabel(status)}
    </span>
  );
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="border border-wesup-ink/20 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
      {category}
    </span>
  );
}

function QuotaMeter({ progress, label }: { progress: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative h-px w-full bg-wesup-ink/20"
    >
      <div
        className="absolute left-0 top-0 h-[3px] -translate-y-px bg-wesup-red transition-[width] duration-300 wesup-ease"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function SupplierDashboard() {
  const [phase, setPhase] = useState<"loading" | "success" | "error">("loading");
  const [dashboard, setDashboard] = useState<SupplierDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void supplierDashboardRepository
      .get({ signal: controller.signal })
      .then((next) => {
        setDashboard(next);
        setPhase("success");
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Dashboard belum dapat dimuat.");
        setPhase("error");
      });
    return () => controller.abort();
  }, [retry]);

  if (phase === "loading") return <DashboardSkeleton />;
  if (phase === "error" || !dashboard) {
    return (
      <ErrorState
        title="Dashboard belum dapat dimuat"
        description={error ?? "Coba lagi beberapa saat."}
        requestId={undefined}
        action={
          <AsyncButton
            onClick={() => {
              setPhase("loading");
              setError(null);
              setRetry((value) => value + 1);
            }}
          >
            Coba lagi
          </AsyncButton>
        }
      />
    );
  }

  const { supplier, summary, recentBatches } = dashboard;
  const isApproved = supplier.verificationStatus === "approved";

  return (
    <div className="space-y-6 sm:space-y-8" aria-busy={false}>
      <header className="flex flex-col gap-5 border-b border-wesup-ink/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-5 flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub">
            <span aria-hidden="true" className="h-px w-6 bg-wesup-red" />
            Wesup / Pemasok
          </p>
          <h1 className="font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.06em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">
            Selamat datang, {supplier.displayName}
          </h1>
          <div className="mt-4">
            {isApproved ? (
              <span className="bg-wesup-paper-sub px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink">
                Akun disetujui
              </span>
            ) : (
              <span className="bg-wesup-red px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper">
                Menunggu verifikasi
              </span>
            )}
          </div>
        </div>
        <Link
          href="/supplier/catalog/new"
          className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-7 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
        >
          Buat Penawaran Baru
          <ArrowDisc />
        </Link>
      </header>

      <section aria-label="Ringkasan aktivitas">
        <dl className="grid grid-cols-1 gap-px border border-wesup-ink/10 bg-wesup-ink/10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col bg-wesup-paper p-5 sm:p-6">
            <dt className="order-2 mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
              Katalog Aktif
            </dt>
            <dd className="order-1 font-landing-display text-2xl font-medium tabular-nums tracking-tight text-wesup-ink sm:text-3xl">
              <span aria-hidden="true" className="mb-4 block h-px w-8 bg-wesup-red" />
              {summary.activeBatchCount}
            </dd>
          </div>
          <div className="flex flex-col bg-wesup-paper p-5 sm:p-6">
            <dt className="order-2 mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
              Total peserta
            </dt>
            <dd className="order-1 font-landing-display text-2xl font-medium tabular-nums tracking-tight text-wesup-ink sm:text-3xl">
              <span aria-hidden="true" className="mb-4 block h-px w-8 bg-wesup-red" />
              {summary.participantCount}
            </dd>
          </div>
          <div className="flex flex-col bg-wesup-paper p-5 sm:p-6">
            <dt className="order-2 mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
              Pendapatan terkumpul
            </dt>
            <dd className="order-1 font-landing-display text-xl font-medium tabular-nums tracking-tight text-wesup-ink sm:text-2xl">
              <span aria-hidden="true" className="mb-4 block h-px w-8 bg-wesup-red" />
              {money.format(summary.collectedRevenue)}
            </dd>
          </div>
          <div className="flex flex-col bg-wesup-paper p-5 sm:p-6">
            <dt className="order-2 mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
              Siap cair
            </dt>
            <dd className="order-1 font-landing-display text-xl font-medium tabular-nums tracking-tight text-wesup-ink sm:text-2xl">
              <span aria-hidden="true" className="mb-4 block h-px w-8 bg-wesup-red" />
              {money.format(summary.readyToDisburse)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Reputasi Supplier" className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-landing-display text-xl font-normal uppercase tracking-[0.04em] text-wesup-ink">
              Reputasi Supplier
            </h2>
            <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">
              Ringkasan rating dari transaksi yang sudah selesai.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-landing-display text-3xl font-medium tabular-nums tracking-tight text-wesup-ink">
              <span aria-hidden="true" className="mb-3 block h-px w-8 bg-wesup-red sm:ml-auto" />
              {summary.ratingAverage === null ? "—" : formatRating(summary.ratingAverage)}
            </p>
            <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
              <span className="tabular-nums">{summary.ratingTotal}</span> ulasan
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-wesup-ink/15 pb-4">
          <h2 className="font-landing-display text-xl font-normal uppercase tracking-[0.04em] text-wesup-ink">
            Katalog terbaru
          </h2>
          <Link
            href="/supplier/catalog"
            className="group inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red"
          >
            Lihat semua
            <ChevronRight aria-hidden="true" className="ml-1 size-4 transition-transform duration-300 wesup-ease group-hover:translate-x-0.5" strokeWidth={1.5} />
          </Link>
        </div>
        {recentBatches.length === 0 ? <EmptyCatalog /> : (
          <ul className="space-y-3">
            {recentBatches.map((batch) => {
              const progress = progressFor(batch.registeredQuantity, batch.targetQuantity);
              return (
                <li key={batch.id}>
                  <Link
                    href={`/supplier/batch/${batch.id}`}
                    className="group block border border-wesup-ink/15 bg-wesup-paper transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusChip status={batch.status} />
                          <CategoryChip category={batch.category} />
                        </div>
                        <h3 className="truncate text-base font-semibold text-wesup-ink underline decoration-transparent underline-offset-[6px] transition-colors duration-300 group-hover:decoration-wesup-red">
                          {batch.title}
                        </h3>
                        <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                          <span className="tabular-nums">{batch.displayCode}</span>
                          {" · "}
                          {batch.timeline.registrationOpensAt
                            ? dates.format(new Date(batch.timeline.registrationOpensAt))
                            : "Jadwal belum tersedia"}
                        </p>
                      </div>
                      <div className="w-full sm:max-w-[14rem]">
                        <p className="mb-2 flex items-center justify-between gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                          <span className="tabular-nums">
                            {batch.registeredQuantity}/{batch.targetQuantity} pcs
                          </span>
                          <span className="tabular-nums">{Math.round(progress)}%</span>
                        </p>
                        <QuotaMeter progress={progress} label={`Kuota ${batch.title}`} />
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="hidden size-4 shrink-0 text-wesup-ink-sub transition-transform duration-300 wesup-ease group-hover:translate-x-0.5 group-hover:text-wesup-red sm:block"
                        strokeWidth={1.5}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border border-wesup-ink/15 bg-wesup-paper-sub p-5">
        <h2 className="font-landing-display text-xl font-normal uppercase tracking-[0.04em] text-wesup-ink">
          Informasi penting
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-wesup-ink-sub">
          {[
            "Katalog baru akan tayang di marketplace setelah diterbitkan.",
            "Lokasi pengambilan terkunci otomatis setelah ada 1 peserta terdaftar.",
            "Skema harga tier terkunci otomatis setelah ada peserta terdaftar.",
            "Dana escrow akan cair otomatis 24 jam setelah serah terima fisik.",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-wesup-red" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat dashboard supplier"
      className="space-y-6 sm:space-y-8"
    >
      <span role="status" className="sr-only">
        Memuat dashboard supplier
      </span>
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-1 gap-px bg-wesup-ink/10 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div className="border border-wesup-ink/15 bg-wesup-paper px-5 py-10 text-center">
      <span aria-hidden="true" className="mx-auto mb-5 block h-px w-10 bg-wesup-ink/25" />
      <span aria-hidden="true" className="mx-auto mb-4 flex size-10 items-center justify-center border border-wesup-ink/20 text-wesup-ink-sub">
        <span className="font-mono text-lg leading-none">+</span>
      </span>
      <p className="text-sm leading-6 text-wesup-ink-sub">
        Belum ada katalog. Mulai buat penawaran pertama Anda.
      </p>
      <Link
        href="/supplier/catalog/new"
        className="group mt-5 inline-flex min-h-11 items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-5 py-2.5 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
      >
        Buat Penawaran
        <Plus aria-hidden="true" className="size-4" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
