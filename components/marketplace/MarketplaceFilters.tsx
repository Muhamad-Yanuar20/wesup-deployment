"use client";

import type { CSSProperties } from "react";
import { MapPin, Tag, Wallet } from "lucide-react";
import { BATCH_CATEGORIES, SEARCH_MAX_RADIUS_KM, SEARCH_MIN_RADIUS_KM, type BatchCategory } from "@/lib/catalog/categories";
import type { MarketplaceFilterErrors } from "@/lib/marketplace/query";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";

export interface MarketplaceFiltersProps {
  idPrefix: "desktop" | "mobile";
  value: MarketplaceFilterValue;
  errors: MarketplaceFilterErrors;
  onChange: (value: MarketplaceFilterValue) => void;
}

function toPriceValue(rawValue: string): number | null {
  if (rawValue === "") return null;
  const value = Number(rawValue);
  return Number.isNaN(value) ? null : value;
}

export default function MarketplaceFilters({ idPrefix, value, errors, onChange }: MarketplaceFiltersProps) {
  const radiusId = `${idPrefix}-marketplace-radius`;
  const minPriceId = `${idPrefix}-marketplace-min-price`;
  const maxPriceId = `${idPrefix}-marketplace-max-price`;
  const radiusErrorId = `${radiusId}-error`;
  const radiusProgress = Math.max(0, Math.min(100, (value.radiusKm - SEARCH_MIN_RADIUS_KM) / (SEARCH_MAX_RADIUS_KM - SEARCH_MIN_RADIUS_KM) * 100));
  const minPriceErrorId = `${minPriceId}-error`;
  const maxPriceErrorId = `${maxPriceId}-error`;
  const priceRangeErrorId = `${idPrefix}-marketplace-price-range-error`;
  const minPriceErrorIds = [errors.minPrice ? minPriceErrorId : null, errors.priceRange ? priceRangeErrorId : null].filter(Boolean).join(" ") || undefined;
  const maxPriceErrorIds = [errors.maxPrice ? maxPriceErrorId : null, errors.priceRange ? priceRangeErrorId : null].filter(Boolean).join(" ") || undefined;
  const toggleCategory = (category: BatchCategory) => {
    const selectedCategories = value.selectedCategories.includes(category) ? value.selectedCategories.filter((selected) => selected !== category) : [...value.selectedCategories, category];
    onChange({ ...value, selectedCategories });
  };

  return (
    <div className="p-6 flex flex-col gap-8">
      <div className="flex items-center gap-2 pb-4 border-b border-wesup-ink/10 text-wesup-ink tabular-nums"><Tag aria-hidden="true" className="w-5 h-5 flex-shrink-0" /><h2 className="text-base font-landing-display font-normal uppercase tracking-[0.04em]">Filter Pencarian</h2></div>
      <fieldset className="flex flex-col gap-4 tabular-nums">
        <legend className="flex w-full items-center justify-between gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub"><span className="inline-flex items-center gap-2"><MapPin aria-hidden="true" className="size-4 shrink-0" />Radius Jarak</span><output htmlFor={radiusId} className="shrink-0 text-sm font-semibold normal-case tracking-normal tabular-nums text-wesup-ink">{value.radiusKm} km</output></legend>
        <div className="mt-2 border border-wesup-ink/15 bg-wesup-paper-sub p-1">
          <div className="relative border border-wesup-ink/10 bg-wesup-paper px-3 py-1">
            <input id={radiusId} type="range" min={SEARCH_MIN_RADIUS_KM} max={SEARCH_MAX_RADIUS_KM} step={1} value={value.radiusKm} aria-label="Radius jarak" aria-valuetext={`${value.radiusKm} kilometer`} aria-describedby={errors.radiusKm ? radiusErrorId : undefined} aria-invalid={Boolean(errors.radiusKm)} onChange={(event) => onChange({ ...value, radiusKm: Number(event.currentTarget.value) })} style={{ "--radius-progress": `${radiusProgress}%` } as CSSProperties} className="marketplace-radius-slider" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-1 flex items-center justify-between font-mono text-[0.625rem] leading-3 tabular-nums text-wesup-ink-sub"><span>{SEARCH_MIN_RADIUS_KM} km</span><span>{SEARCH_MAX_RADIUS_KM} km</span></div>
          </div>
          {errors.radiusKm ? <p id={radiusErrorId} className="mt-2 text-xs font-medium text-wesup-ink">{errors.radiusKm}</p> : null}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-4 tabular-nums">
        <legend className="flex items-center gap-2 text-wesup-ink-sub font-mono text-[0.6875rem] uppercase tracking-[0.18em] tabular-nums"><Tag aria-hidden="true" className="w-4 h-4 text-wesup-ink-sub flex-shrink-0" /><span className="font-medium text-sm">Kategori Produk</span></legend>
        <div className="flex flex-col gap-3 tabular-nums">
          {BATCH_CATEGORIES.map((category, index) => {
            const categoryId = `${idPrefix}-marketplace-category-${index}`;
            const checked = value.selectedCategories.includes(category);
            return <label key={category} htmlFor={categoryId} className="group flex min-h-11 cursor-pointer items-center gap-3 px-1 py-1.5 transition-colors hover:bg-wesup-paper focus-within:bg-wesup-paper font-mono text-[0.6875rem] uppercase tracking-[0.18em]"><span className="relative flex h-4 w-4 shrink-0 items-center justify-center"><input id={categoryId} type="checkbox" checked={checked} onChange={() => toggleCategory(category)} className="peer h-4 w-4 shrink-0 appearance-none border border-wesup-ink/20 bg-wesup-paper transition-colors checked:border-wesup-ink/20 checked:bg-wesup-ink focus:outline-none cursor-pointer" /><svg aria-hidden="true" className="pointer-events-none absolute h-3 w-3 text-wesup-paper opacity-0 peer-checked:opacity-100 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span><span className="text-sm font-medium text-wesup-ink-sub group-hover:text-wesup-ink transition-colors">{category}</span></label>;
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-4 tabular-nums">
        <legend className="flex items-center gap-2 text-wesup-ink-sub font-mono text-[0.6875rem] uppercase tracking-[0.18em] tabular-nums"><Wallet aria-hidden="true" className="w-4 h-4 text-wesup-ink-sub flex-shrink-0" /><span className="font-medium text-sm">Rentang Harga</span></legend>
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="relative flex items-center"><label htmlFor={minPriceId} className="sr-only">Harga minimum</label><span aria-hidden="true" className="absolute left-3 text-sm font-medium text-wesup-ink-sub pointer-events-none">Rp</span><input id={minPriceId} type="number" min={0} inputMode="numeric" value={value.minPrice ?? ""} placeholder="Min" aria-invalid={Boolean(errors.minPrice || errors.priceRange)} aria-describedby={minPriceErrorIds} onChange={(event) => onChange({ ...value, minPrice: toPriceValue(event.currentTarget.value) })} className="w-full pl-9 pr-3 py-2 text-sm bg-wesup-paper border border-wesup-ink/15 text-wesup-ink placeholder:text-wesup-ink-sub focus:outline-none focus:border-wesup-ink/20 transition-colors duration-500 wesup-ease" /></div>
          <div className="relative flex items-center"><label htmlFor={maxPriceId} className="sr-only">Harga maksimum</label><span aria-hidden="true" className="absolute left-3 text-sm font-medium text-wesup-ink-sub pointer-events-none">Rp</span><input id={maxPriceId} type="number" min={0} inputMode="numeric" value={value.maxPrice ?? ""} placeholder="Maks" aria-invalid={Boolean(errors.maxPrice || errors.priceRange)} aria-describedby={maxPriceErrorIds} onChange={(event) => onChange({ ...value, maxPrice: toPriceValue(event.currentTarget.value) })} className="w-full pl-9 pr-3 py-2 text-sm bg-wesup-paper border border-wesup-ink/15 text-wesup-ink placeholder:text-wesup-ink-sub focus:outline-none focus:border-wesup-ink/20 transition-colors duration-500 wesup-ease" /></div>
        </div>
        {errors.minPrice ? <p id={minPriceErrorId} className="text-xs font-medium text-wesup-ink">{errors.minPrice}</p> : null}
        {errors.maxPrice ? <p id={maxPriceErrorId} className="text-xs font-medium text-wesup-ink">{errors.maxPrice}</p> : null}
        {errors.priceRange ? <p id={priceRangeErrorId} className="text-xs font-medium text-wesup-ink">{errors.priceRange}</p> : null}
      </fieldset>
    </div>
  );
}
