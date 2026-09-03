"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Package, Search, SlidersHorizontal } from "lucide-react";
import { SUPPLIER_BATCH_MOCKS } from "@/lib/supplier-batch/mock-data";
import type { SupplierBatchStatus } from "@/lib/supplier-batch/types";
import CatalogCard from "@/components/supplier/catalog/CatalogCard";

type FilterTab = "ALL" | SupplierBatchStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "PUBLISHED", label: "Aktif" },
  { value: "CANCELLED_BY_SUPPLIER", label: "Dibatalkan" },
];

export default function CatalogListClient() {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBatches = useMemo(() => {
    let batches = [...SUPPLIER_BATCH_MOCKS];

    if (activeTab !== "ALL") {
      batches = batches.filter((b) => b.status === activeTab);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      batches = batches.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.displayCode.toLowerCase().includes(query) ||
          b.category.toLowerCase().includes(query),
      );
    }

    return batches;
  }, [activeTab, searchQuery]);

  const counts = useMemo(() => {
    const all = SUPPLIER_BATCH_MOCKS.length;
    const published = SUPPLIER_BATCH_MOCKS.filter(
      (b) => b.status === "PUBLISHED",
    ).length;
    const cancelled = SUPPLIER_BATCH_MOCKS.filter(
      (b) => b.status === "CANCELLED_BY_SUPPLIER",
    ).length;
    return { ALL: all, PUBLISHED: published, CANCELLED_BY_SUPPLIER: cancelled };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Katalog Saya
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola seluruh penawaran bahan baku Anda.
          </p>
        </div>
        <Link
          href="/supplier/catalog/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" size={18} />
          Buat Penawaran
        </Link>
      </section>

      {/* Search + Filters */}
      <section className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search
            aria-hidden="true"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Cari katalog berdasarkan nama, kode, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            aria-label="Cari katalog"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <SlidersHorizontal
            aria-hidden="true"
            size={14}
            className="ml-2 shrink-0 text-slate-400"
          />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={
                activeTab === tab.value
                  ? "flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm sm:flex-none sm:px-4"
                  : "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 sm:flex-none sm:px-4"
              }
              aria-pressed={activeTab === tab.value}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">
                ({counts[tab.value]})
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      <section aria-label="Daftar katalog">
        {filteredBatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Package
              aria-hidden="true"
              size={40}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              {searchQuery.trim()
                ? `Tidak ada katalog yang cocok dengan "${searchQuery}".`
                : activeTab === "PUBLISHED"
                  ? "Belum ada katalog aktif."
                  : activeTab === "CANCELLED_BY_SUPPLIER"
                    ? "Tidak ada katalog yang dibatalkan."
                    : "Belum ada katalog. Mulai buat penawaran pertama Anda."}
            </p>
            {!searchQuery.trim() && (
              <Link
                href="/supplier/catalog/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus aria-hidden="true" size={16} />
                Buat Penawaran
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Menampilkan {filteredBatches.length} katalog
              {searchQuery.trim() && ` untuk "${searchQuery}"`}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
