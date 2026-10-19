"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { validateMarketplaceFilters, type MarketplaceFilterErrors } from "@/lib/marketplace/query";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";
import MarketplaceFilters from "./MarketplaceFilters";

export interface MarketplaceMobileFilterDrawerProps {
  open: boolean;
  value: MarketplaceFilterValue;
  errors: MarketplaceFilterErrors;
  onChange: (value: MarketplaceFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

export default function MarketplaceMobileFilterDrawer({ open, value, errors, onChange, onApply, onReset, onClose }: MarketplaceMobileFilterDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const applyDisabled = Object.keys(validateMarketplaceFilters(value)).length > 0;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);
  const restoreFocus = () => openerRef.current?.focus();

  return (
    <dialog ref={dialogRef} id="marketplace-mobile-filter-drawer" aria-labelledby="marketplace-mobile-filter-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={restoreFocus} className="m-0 ml-auto h-full max-h-none w-full max-w-sm border-l border-wesup-ink/20 bg-wesup-paper p-0 text-wesup-ink backdrop:bg-wesup-paper-sub lg:hidden">
      <div className="flex h-full flex-col tabular-nums">
        <div className="flex items-center justify-between gap-4 border-b border-wesup-ink/15 px-6 py-4 tabular-nums"><h2 id="marketplace-mobile-filter-title" className="text-lg text-wesup-ink font-landing-display font-normal uppercase tracking-[0.04em]">Filter Pencarian</h2><button type="button" onClick={onClose} className="flex items-center gap-2 p-2 text-wesup-ink-sub hover:bg-wesup-paper-sub hover:text-wesup-ink transition-colors tabular-nums"><X aria-hidden="true" className="h-5 w-5 flex-shrink-0" /><span className="sr-only">Tutup filter</span></button></div>
        <div className="flex-1 overflow-y-auto tabular-nums"><MarketplaceFilters idPrefix="mobile" value={value} errors={errors} onChange={onChange} /></div>
        <div className="grid grid-cols-3 gap-3 border-t border-wesup-ink/15 bg-wesup-paper px-4 py-4"><button type="button" onClick={onReset} className="border border-wesup-ink/15 px-3 py-2 text-sm font-semibold text-wesup-ink-sub hover:bg-wesup-paper transition-colors">Reset</button><button type="button" onClick={onClose} className="border border-wesup-ink/15 px-3 py-2 text-sm font-semibold text-wesup-ink-sub hover:bg-wesup-paper transition-colors">Batal</button><button type="button" disabled={applyDisabled} onClick={onApply} className="bg-wesup-ink px-3 py-2 text-sm font-semibold text-wesup-paper hover:bg-wesup-red transition-colors disabled:cursor-not-allowed disabled:opacity-40">Terapkan</button></div>
      </div>
    </dialog>
  );
}
