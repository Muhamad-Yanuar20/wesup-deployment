"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ListFilter, Search } from "lucide-react";
import { SEARCH_DEFAULT_RADIUS_KM } from "@/lib/catalog/categories";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { marketplaceApiRepository, MarketplaceReadError } from "@/lib/marketplace/api-repository";
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
  const refreshError = useMarketplaceStore(state => state.refreshError);
  const expireItems = useMarketplaceStore(state => state.expireItems);
  const retryAtRef = useRef(0);
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

    let controller: AbortController | null = null;
    let disposed = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let serverMs = NaN;
    let synchronizedAt = 0;
    let hasResult = false;
    let deadlines: number[] = [];
    const expire = () => {
      if (Number.isFinite(serverMs)) expireItems(serverMs + performance.now() - synchronizedAt);
    };
    const armDeadline = () => {
      clearTimeout(deadlineTimer);
      if (!Number.isFinite(serverMs)) return;
      const now = serverMs + performance.now() - synchronizedAt;
      const next = deadlines.find(value => value > now);
      if (next !== undefined && next - now < 2_147_483_647) {
        deadlineTimer = setTimeout(() => { expire(); armDeadline(); void run(true); }, Math.ceil(next - now));
      }
    };
    const run = async (background: boolean) => {
      if (disposed || controller || (background && document.visibilityState === "hidden")) return;
      const wait = retryAtRef.current - performance.now();
      if (wait > 0) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void run(background), wait);
        return;
      }
      const active = new AbortController();
      controller = active;
      const startedAt = performance.now();
      const quiet = background && hasResult;
      const requestId = beginRequest(quiet);
      try {
        const result = await marketplaceApiRepository.search(
          { query: debouncedQuery, ...requestFilters, page: currentPage, pageSize: PAGE_SIZE },
          { signal: active.signal },
        );
        if (disposed || active.signal.aborted) return;
        if (!result.items.length && currentPage > 1) { setPage(1); return; }
        serverMs = Date.parse(result.serverTime ?? result.items[0]?.serverTime ?? "");
        synchronizedAt = startedAt;
        resolveRequest(requestId, result);
        hasResult = true;
        expire();
        deadlines = result.items.map(item => Date.parse(item.registrationClosesAt)).filter(Number.isFinite).sort((a, b) => a - b);
        armDeadline();
      } catch (reason) {
        if (disposed || active.signal.aborted) return;
        if (reason instanceof MarketplaceReadError) retryAtRef.current = performance.now() + reason.retryAfterMs;
        rejectRequest(requestId, reason instanceof Error ? reason.message : "Gagal memuat penawaran.", quiet);
      } finally { if (controller === active) controller = null; }
    };
    void run(false);
    const interval = setInterval(() => { expire(); void run(true); }, 15_000);
    const visible = () => {
      if (document.visibilityState !== "hidden") { expire(); void run(true); }
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
      clearTimeout(deadlineTimer);
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
    };
  }, [debouncedQuery, requestFilters, currentPage, retryRevision, beginRequest, blockRequest, resolveRequest, rejectRequest, expireItems, setPage]);

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
              {refreshError && <div role="status" className="mb-5 border-l-2 border-wesup-red pl-4 text-sm leading-7"><p>Pembaruan belum berhasil. Ketersediaan terakhir ditampilkan. {refreshError}</p><button type="button" onClick={retry} className="min-h-11 font-semibold underline underline-offset-4">Coba lagi</button></div>}
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
