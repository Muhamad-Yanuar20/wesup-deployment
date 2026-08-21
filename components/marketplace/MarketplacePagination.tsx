import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MarketplacePagination() {
    return (
        <div className="flex items-center justify-center w-full mt-8 mb-4">
            <nav className="flex items-center gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm" aria-label="Pagination Navigation">

                {/* Prev Button - Format mutlak [icon] [Label] */}
                <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-500 bg-transparent rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled
                >
                    <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                    <span>Prev</span>
                </button>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1.5 px-2">
                    <button type="button" className="w-10 h-10 flex items-center justify-center text-sm font-bold text-white bg-blue-600 rounded-lg shadow-sm">
                        1
                    </button>
                    <button type="button" className="w-10 h-10 flex items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        2
                    </button>
                    <button type="button" className="w-10 h-10 flex items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        3
                    </button>
                    <span className="flex items-center justify-center w-8 h-10 text-slate-400 font-medium">
                        ...
                    </span>
                    <button type="button" className="w-10 h-10 flex items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        12
                    </button>
                </div>

                {/* Next Button - WAJIB MENGGUNAKAN Format mutlak [icon] [Label] sesuai aturan */}
                <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-transparent rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    <span>Next</span>
                </button>

            </nav>
        </div>
    );
}
