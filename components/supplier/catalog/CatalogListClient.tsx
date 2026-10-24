"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { supplierCatalogApiRepository } from "@/lib/supplier-catalog/api-repository";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";
import CatalogCard from "@/components/supplier/catalog/CatalogCard";
import { ArrowDisc, ErrorState, AsyncButton, Skeleton } from "@/components/feedback";

type FilterTab = "ALL" | "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED_BY_SUPPLIER";
type LoadPhase = "loading" | "success" | "error";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "PUBLISHED", label: "Aktif" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED_BY_SUPPLIER", label: "Dibatalkan" },
];

const EMPTY_MESSAGES: Record<FilterTab, string> = {
  ALL: "Belum ada katalog. Mulai buat penawaran pertama Anda.",
  DRAFT: "Belum ada katalog draft.",
  PUBLISHED: "Belum ada katalog aktif.",
  COMPLETED: "Belum ada katalog selesai.",
  CANCELLED_BY_SUPPLIER: "Tidak ada katalog yang dibatalkan.",
};

function SkeletonCard() {
  return <Skeleton className="h-72 w-full" />;
}

export default function CatalogListClient() {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<SupplierBatchDetail[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ ALL: 0 });
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setPhase("loading");
    setError(null);
    try {
      const response = await supplierCatalogApiRepository.list({ query: searchQuery, signal });
      if (!signal.aborted) {
        setItems(response.items);
        setCounts(response.counts);
        setPhase("success");
      }
    } catch (requestError) {
      if (signal.aborted) return;
      setPhase("error");
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat katalog.");
    }
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, retry]);

  const filteredBatches = useMemo(() => {
    if (activeTab === "ALL") return items;
    return items.filter((batch) => batch.status === activeTab as SupplierBatchStatus);
  }, [activeTab, items]);

  const activeCount = counts[activeTab] ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-wesup-ink/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-5 flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub">
            <span aria-hidden="true" className="h-px w-6 bg-wesup-red" />
            Wesup / Katalog
          </p>
          <h1 className="font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.06em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">
            Katalog Saya
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-wesup-ink-sub">Kelola seluruh penawaran bahan baku Anda.</p>
        </div>
        <Link
          href="/supplier/catalog/new"
          className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-7 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
        >
          <Plus aria-hidden="true" size={18} strokeWidth={1.5} /> Buat Penawaran
          <ArrowDisc />
        </Link>
      </header>

      <section className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-wesup-ink-sub" />
          <input
            type="search"
            placeholder="Cari katalog berdasarkan nama, kode, atau kategori..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full border border-wesup-ink/20 bg-wesup-paper px-11 py-2.5 text-sm text-wesup-ink outline-none placeholder:text-wesup-ink-sub focus:border-wesup-red"
            aria-label="Cari katalog"
          />
        </div>
        <div className="flex flex-wrap items-center gap-px border border-wesup-ink/15 bg-wesup-ink/10 p-0">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={
                activeTab === tab.value
                  ? "flex-1 bg-wesup-ink px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper sm:flex-none"
                  : "flex-1 bg-wesup-paper px-4 py-2 text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink transition-colors duration-300 hover:bg-wesup-paper-sub sm:flex-none"
              }
              aria-pressed={activeTab === tab.value}
            >
              {tab.label}
              <span className="ml-2 tabular-nums">({counts[tab.value] ?? 0})</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Daftar katalog" aria-busy={phase === "loading"}>
        {phase === "loading" ? (
          <div className="grid grid-cols-1 gap-px bg-wesup-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((key) => (
              <SkeletonCard key={key} />
            ))}
          </div>
        ) : phase === "error" ? (
          <ErrorState
            title="Katalog belum bisa dimuat"
            description={error ?? "Terjadi kesalahan pada server."}
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
        ) : filteredBatches.length === 0 ? (
          <section className="border border-wesup-ink/15 bg-wesup-paper px-5 py-10 text-center">
            <span aria-hidden="true" className="mx-auto mb-5 block h-px w-10 bg-wesup-ink/25" />
            <span aria-hidden="true" className="mx-auto mb-4 flex size-10 items-center justify-center border border-wesup-ink/20 text-wesup-ink-sub">
              <Package aria-hidden="true" size={18} strokeWidth={1.5} />
            </span>
            <p className="text-sm leading-6 text-wesup-ink-sub">
              {searchQuery.trim() ? `Tidak ada katalog yang cocok dengan "${searchQuery}".` : EMPTY_MESSAGES[activeTab]}
            </p>
            {!searchQuery.trim() && activeTab === "ALL" && (
              <div className="mt-5 flex justify-center">
                <Link
                  href="/supplier/catalog/new"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-7 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
                >
                  Buat Penawaran
                  <Plus aria-hidden="true" size={18} strokeWidth={1.5} />
                </Link>
              </div>
            )}
          </section>
        ) : (
          <>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
              Menampilkan <span className="tabular-nums">{filteredBatches.length}</span> katalog
              {searchQuery.trim() && <> · &quot;<span className="normal-case tracking-normal">{searchQuery}</span>&quot;</>}
              {activeTab !== "ALL" && <> · <span className="tabular-nums">{activeCount}</span> pada tab ini</>}
            </p>
            <div className="grid grid-cols-1 gap-px bg-wesup-ink/10 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBatches.map((batch) => (
                <CatalogCard key={batch.id} batch={batch} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
