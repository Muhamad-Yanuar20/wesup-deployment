import { PackageX, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export interface MarketplaceEmptyStateProps {
  hasActiveFilters: boolean;
  onReset: () => void;
}

export default function MarketplaceEmptyState({
  hasActiveFilters,
  onReset,
}: MarketplaceEmptyStateProps) {
  return (
    <div className="min-h-[400px] w-full border border-wesup-ink/15 bg-wesup-paper">
      <EmptyState
        illustration={
          <div className="flex h-24 w-24 items-center justify-center border border-wesup-ink/10 bg-wesup-paper tabular-nums">
            <PackageX aria-hidden="true" className="h-16 w-16 text-wesup-ink-sub" />
          </div>
        }
        heading="Barang tidak ditemukan"
        description="Coba ubah filter rentang harga, lokasi, atau kategori produk untuk melihat hasil yang berbeda."
        action={
          hasActiveFilters ? (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-2 border border-wesup-ink/10 bg-wesup-paper px-4 py-2 text-sm font-semibold text-wesup-ink-sub transition-colors hover:bg-wesup-paper-sub tabular-nums"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
              <span>Reset filter</span>
            </button>
          ) : null
        }
      />
    </div>
  );
}
