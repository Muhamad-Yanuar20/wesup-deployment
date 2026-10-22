"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ListFilter, Search } from "lucide-react";
import { SEARCH_DEFAULT_RADIUS_KM } from "@/lib/catalog/categories";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { marketplaceApiRepository } from "@/lib/marketplace/api-repository";
import { validateMarketplaceFilters } from "@/lib/marketplace/query";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";
import { MarketplaceStoreProvider, useMarketplaceStore } from "@/store/marketplace-provider";
import MarketplaceFilters from "./MarketplaceFilters";
import MarketplaceMobileFilterDrawer from "./MarketplaceMobileFilterDrawer";
import MarketplaceResults from "./MarketplaceResults";
import MarketplaceRadiusMapClient from "./MarketplaceRadiusMapClient";
import { AppPanel } from "@/components/layout/AppPanel";

const PAGE_SIZE = 12 as const;
function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia?.("(min-width: 1024px)");
  media?.addEventListener("change", callback);
  return () => media?.removeEventListener("change", callback);
}

export default function MarketplaceClient() {
  return (
    <MarketplaceStoreProvider>
      <MarketplaceController />
    </MarketplaceStoreProvider>
  );
}

function MarketplaceController() {
  const [mapOpen, setMapOpen] = useState(false);
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia?.("(min-width: 1024px)").matches ?? false, () => false);
  const draftQuery = useMarketplaceStore((state) => state.draftQuery);
  const debouncedQuery = useMarketplaceStore((state) => state.debouncedQuery);
  const selectedCategories = useMarketplaceStore((state) => state.selectedCategories);
  const minPrice = useMarketplaceStore((state) => state.minPrice);
  const maxPrice = useMarketplaceStore((state) => state.maxPrice);
  const radiusKm = useMarketplaceStore((state) => state.radiusKm);
  const currentPage = useMarketplaceStore((state) => state.currentPage);
  const drawerFilters = useMarketplaceStore((state) => state.drawerFilters);
  const isFilterDrawerOpen = useMarketplaceStore((state) => state.isFilterDrawerOpen);
  const items = useMarketplaceStore((state) => state.items);
  const origin = useMarketplaceStore((state) => state.origin);
  const total = useMarketplaceStore((state) => state.total);
  const totalPages = useMarketplaceStore((state) => state.totalPages);
  const loading = useMarketplaceStore((state) => state.loading);
  const error = useMarketplaceStore((state) => state.error);
  const retryRevision = useMarketplaceStore((state) => state.retryRevision);
  const setDraftQuery = useMarketplaceStore((state) => state.setDraftQuery);
  const setDebouncedQuery = useMarketplaceStore((state) => state.setDebouncedQuery);
  const toggleCategory = useMarketplaceStore((state) => state.toggleCategory);
  const setMinPrice = useMarketplaceStore((state) => state.setMinPrice);
  const setMaxPrice = useMarketplaceStore((state) => state.setMaxPrice);
  const setRadiusKm = useMarketplaceStore((state) => state.setRadiusKm);
  const setPage = useMarketplaceStore((state) => state.setPage);
  const openFilterDrawer = useMarketplaceStore((state) => state.openFilterDrawer);
  const closeFilterDrawer = useMarketplaceStore((state) => state.closeFilterDrawer);
  const updateDrawerFilters = useMarketplaceStore((state) => state.updateDrawerFilters);
  const resetDrawerFilters = useMarketplaceStore((state) => state.resetDrawerFilters);
  const applyDrawerFilters = useMarketplaceStore((state) => state.applyDrawerFilters);
  const resetAllFilters = useMarketplaceStore((state) => state.resetAllFilters);
  const retry = useMarketplaceStore((state) => state.retry);
  const beginRequest = useMarketplaceStore((state) => state.beginRequest);
  const blockRequest = useMarketplaceStore((state) => state.blockRequest);
  const resolveRequest = useMarketplaceStore((state) => state.resolveRequest);
  const rejectRequest = useMarketplaceStore((state) => state.rejectRequest);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const filters = useMemo(
    () => ({ selectedCategories, minPrice, maxPrice, radiusKm }),
    [selectedCategories, minPrice, maxPrice, radiusKm],
  );
  const debouncedValue = useDebouncedValue(draftQuery, 400);
  const appliedRadiusKm = useDebouncedValue(radiusKm, 400);
  const requestFilters = useMemo(
    () => ({ selectedCategories, minPrice, maxPrice, radiusKm: appliedRadiusKm }),
    [selectedCategories, minPrice, maxPrice, appliedRadiusKm],
  );
  const appliedErrors = useMemo(
    () => validateMarketplaceFilters(requestFilters),
    [requestFilters],
  );
  const drawerErrors = useMemo(() => validateMarketplaceFilters(drawerFilters), [drawerFilters]);
  const hasActiveFilters =
    draftQuery.trim() !== "" ||
    selectedCategories.length > 0 ||
    minPrice !== null ||
    maxPrice !== null ||
    radiusKm !== SEARCH_DEFAULT_RADIUS_KM;

  useEffect(() => {
    setDebouncedQuery(debouncedValue.trim());
  }, [debouncedValue, setDebouncedQuery]);

  useEffect(() => {
    const validationErrors = validateMarketplaceFilters(requestFilters);
    if (Object.keys(validationErrors).length > 0) {
      blockRequest();
      return;
    }

    const controller = new AbortController();
    const requestId = beginRequest();
    void marketplaceApiRepository
      .search(
        { query: debouncedQuery, ...requestFilters, page: currentPage, pageSize: PAGE_SIZE },
        { signal: controller.signal },
      )
      .then((result) => resolveRequest(requestId, result))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        rejectRequest(
          requestId,
          reason instanceof Error ? reason.message : "Gagal memuat penawaran.",
        );
      });
    return () => controller.abort();
  }, [
    debouncedQuery,
    requestFilters,
    currentPage,
    retryRevision,
    beginRequest,
    blockRequest,
    resolveRequest,
    rejectRequest,
  ]);

  const updateAppliedFilters = useCallback(
    (nextValue: MarketplaceFilterValue) => {
      const nextCategories = nextValue.selectedCategories;
      selectedCategories
        .filter((category) => !nextCategories.includes(category))
        .forEach((category) => toggleCategory(category));
      nextCategories
        .filter((category) => !selectedCategories.includes(category))
        .forEach((category) => toggleCategory(category));
      if (nextValue.minPrice !== minPrice) setMinPrice(nextValue.minPrice);
      if (nextValue.maxPrice !== maxPrice) setMaxPrice(nextValue.maxPrice);
      if (nextValue.radiusKm !== radiusKm) setRadiusKm(nextValue.radiusKm);
    },
    [
      maxPrice,
      minPrice,
      radiusKm,
      selectedCategories,
      setMaxPrice,
      setMinPrice,
      setRadiusKm,
      toggleCategory,
    ],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setPage(page);
      resultHeadingRef.current?.focus();
    },
    [setPage],
  );

  return (
    <div className="space-y-1 font-sans">
      <div className="flex flex-col gap-5 tabular-nums">
        <div className="flex items-stretch gap-3 border border-wesup-ink/15 bg-wesup-paper-sub p-1.5">
          <div className="flex-1 relative group tabular-nums">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-wesup-ink-sub group-focus-within:text-wesup-ink-sub transition-colors"
              />
            </div>
            <label htmlFor="marketplace-search" className="sr-only">
              Cari penawaran marketplace
            </label>
            <input
              id="marketplace-search"
              type="search"
              value={draftQuery}
              maxLength={120}
              onChange={(event) => setDraftQuery(event.target.value)}
              className="block w-full pl-10 pr-4 py-3 text-sm bg-wesup-paper border border-wesup-ink/15 text-wesup-ink placeholder:text-wesup-ink-sub focus:outline-none focus:border-wesup-ink/20 transition-colors duration-500 wesup-ease"
              placeholder="Cari produk UMKM terdekat..."
            />
          </div>
          <button
            type="button"
            onClick={openFilterDrawer}
            className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-3 min-h-11 border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-sm font-semibold text-wesup-ink-sub transition-colors hover:bg-wesup-paper"
            aria-label="Buka filter pencarian"
          >
            <ListFilter aria-hidden="true" className="w-4 h-4" />
            Filter
          </button>
        </div>

        {origin?.needsProfileLocation ? (
          <div className="flex flex-col gap-3 border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-sm text-wesup-ink sm:flex-row sm:items-center sm:justify-between tabular-nums" role="status" aria-live="polite">
            <p><strong>Lokasi usaha belum tersimpan.</strong> Jarak sementara dihitung dari pusat Bandung.</p>
            <Link href="/umkm/onboarding?returnTo=/marketplace" className="inline-flex min-h-11 shrink-0 items-center justify-center bg-wesup-ink px-4 py-2.5 text-sm font-bold text-wesup-paper hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Simpan lokasi</Link>
          </div>
        ) : null}

        <div className="grid gap-6 tabular-nums lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start">
          <aside className="min-w-0 space-y-5">
          <AppPanel className="hidden lg:block" panelClassName="!p-0">
            <MarketplaceFilters
              idPrefix="desktop"
              value={filters}
              errors={appliedErrors}
              onChange={updateAppliedFilters}
            />
          </AppPanel>
          {origin && <section className="border border-wesup-ink/15 bg-wesup-paper-sub p-1.5">
            <button type="button" aria-expanded={mapOpen} aria-controls="marketplace-area-map" onClick={() => setMapOpen(open => !open)} className="flex min-h-12 w-full items-center justify-between gap-3 bg-wesup-paper px-4 text-sm font-semibold lg:hidden">Lihat area pickup<span aria-hidden="true">{mapOpen ? "−" : "+"}</span></button>
            <div id="marketplace-area-map" hidden={!desktop && !mapOpen}>
              {(desktop || mapOpen) && <MarketplaceRadiusMapClient origin={origin} items={items} radiusKm={radiusKm} compact />}
            </div>
          </section>}
          </aside>
          <div className="flex-1 w-full min-w-0 tabular-nums">
            <div className="w-full min-w-0">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-wesup-ink/10 pb-5">
                <div>
                  <h2
                    ref={resultHeadingRef}
                    tabIndex={-1}
                    className="text-xl text-wesup-ink focus:outline-none font-landing-display font-normal uppercase tracking-[0.04em]"
                  >
                    Penawaran marketplace
                  </h2>
                  <p className="mt-1 text-sm font-medium text-wesup-ink-sub">
                    {loading ? "Sedang menyiapkan penawaran…" : `${total} penawaran ditemukan`}
                  </p>
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="border border-wesup-ink/15 px-3 py-2 text-sm font-semibold text-wesup-ink-sub hover:bg-wesup-paper transition-colors"
                  >
                    Reset filter
                  </button>
                ) : null}
              </div>
              <MarketplaceResults
                items={items}
                total={total}
                loading={loading}
                error={error}
                hasActiveFilters={hasActiveFilters}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onRetry={retry}
                onReset={resetAllFilters}
              />
            </div>
          </div>
        </div>
      </div>

      <MarketplaceMobileFilterDrawer
        open={isFilterDrawerOpen}
        value={drawerFilters}
        errors={drawerErrors}
        onChange={updateDrawerFilters}
        onApply={applyDrawerFilters}
        onReset={resetDrawerFilters}
        onClose={closeFilterDrawer}
      />
    </div>
  );
}
