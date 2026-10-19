import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationItems } from "@/lib/marketplace/query";

export interface MarketplacePaginationProps { currentPage: number; totalPages: number; disabled?: boolean; onPageChange: (page: number) => void; }

export default function MarketplacePagination({ currentPage, totalPages, disabled = false, onPageChange }: MarketplacePaginationProps) {
  const previousDisabled = disabled || currentPage <= 1;
  const nextDisabled = disabled || currentPage >= totalPages;
  return (
    <div className="flex items-center justify-center w-full mt-8 mb-4 tabular-nums">
      <nav className="flex items-center gap-1.5 p-1.5 bg-wesup-paper border border-wesup-ink/15 tabular-nums" aria-label="Pagination Navigation">
        <button type="button" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-wesup-ink-sub bg-transparent hover:bg-wesup-paper-sub hover:text-wesup-ink-sub transition-colors disabled:opacity-40 disabled:cursor-not-allowed tabular-nums" disabled={previousDisabled} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft aria-hidden="true" className="w-4 h-4 flex-shrink-0" /><span>Prev</span></button>
        <div className="hidden sm:flex items-center gap-1.5 px-2">
          {getPaginationItems(currentPage, totalPages).map((page, index) => page === "ellipsis" ? <span key={`ellipsis-${index}`} aria-hidden="true" className="flex items-center justify-center w-8 h-10 text-wesup-ink-sub font-medium tabular-nums">...</span> : <button key={page} type="button" aria-label={`Halaman ${page}`} aria-current={page === currentPage ? "page" : undefined} disabled={disabled} onClick={() => onPageChange(page)} className={page === currentPage ? "w-10 h-10 flex items-center justify-center text-sm font-bold text-wesup-paper bg-wesup-ink   disabled:opacity-40 disabled:cursor-not-allowed" : "w-10 h-10 flex items-center justify-center text-sm font-semibold text-wesup-ink-sub hover:bg-wesup-paper-sub  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"}>{page}</button>)}
        </div>
        <button type="button" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-wesup-ink-sub bg-transparent hover:bg-wesup-paper-sub hover:text-wesup-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed tabular-nums" disabled={nextDisabled} onClick={() => onPageChange(currentPage + 1)}><ChevronRight aria-hidden="true" className="w-4 h-4 flex-shrink-0" /><span>Next</span></button>
      </nav>
    </div>
  );
}
