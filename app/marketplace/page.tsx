import React from 'react';
import {
    Search,
    MapPin,
    Tag,
    Wallet,
    Menu,
    Filter,
    LayoutGrid
} from 'lucide-react';

export default function MarketplacePage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
            {/* HEADER / TOPBAR */}
            <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm h-16">
                <div className="max-w-[1440px] mx-auto w-full h-full px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">

                    {/* Mobile Menu Toggle & Brand */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="md:hidden flex items-center gap-2 p-2 -ml-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
                            aria-label="Toggle menu filter"
                        >
                            <Menu className="w-5 h-5 flex-shrink-0" />
                        </button>
                        <div className="hidden md:flex items-center font-bold text-xl text-slate-800">
                            Wesup
                        </div>
                    </div>

                    {/* Search Bar (Siap debounce) */}
                    <div className="flex-1 max-w-2xl mx-auto w-full relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        </div>
                        <input
                            type="search"
                            className="block w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-inner"
                            placeholder="Cari produk UMKM terdekat..."
                        />
                    </div>

                    {/* Right section placeholder */}
                    <div className="w-8 md:w-16"></div>
                </div>
            </header>

            {/* LAYOUT UTAMA */}
            <div className="flex-1 max-w-[1440px] mx-auto w-full flex items-start overflow-hidden relative">

                {/* SIDEBAR / FILTER SECTION (Desktop) */}
                {/* Di mobile: Sidebar secara visual disembunyikan (bisa dipicu menjadi drawer via state React nantinya) */}
                <aside className="hidden md:flex flex-col w-[280px] lg:w-[320px] flex-shrink-0 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
                    <div className="p-6 flex flex-col gap-8">

                        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 text-slate-800">
                            <Filter className="w-5 h-5 flex-shrink-0" />
                            <h2 className="font-semibold text-base">Filter Pencarian</h2>
                        </div>

                        {/* Filter: Radius Jarak */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 text-slate-700">
                                <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <h3 className="font-medium text-sm">Radius Jarak (km)</h3>
                            </div>
                            <div className="px-1">
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    defaultValue="10"
                                    aria-label="Slider Radius Jarak"
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                                <div className="flex justify-between items-center mt-3 text-xs font-medium text-slate-500">
                                    <span>1 km</span>
                                    <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full shadow-sm">10 km</span>
                                    <span>50 km</span>
                                </div>
                            </div>
                        </div>

                        {/* Filter: Kategori Item */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 text-slate-700">
                                <Tag className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <h3 className="font-medium text-sm">Kategori Produk</h3>
                            </div>
                            <div className="flex flex-col gap-3">
                                {['Sayur & Buah', 'Daging & Ikan', 'Makanan Siap Saji', 'Kerajinan', 'Jasa'].map((kategori) => (
                                    <label key={kategori} className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                defaultChecked={kategori === 'Sayur & Buah'}
                                                className="peer appearance-none w-4 h-4 bg-white border border-slate-300 rounded-[4px] checked:bg-blue-600 checked:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
                                            />
                                            <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                                            {kategori}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Filter: Rentang Harga */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 text-slate-700">
                                <Wallet className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <h3 className="font-medium text-sm">Rentang Harga</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3 items-center">
                                <div className="relative flex items-center">
                                    <span className="absolute left-3 text-sm font-medium text-slate-400 pointer-events-none">Rp</span>
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                    />
                                </div>
                                <div className="relative flex items-center">
                                    <span className="absolute left-3 text-sm font-medium text-slate-400 pointer-events-none">Rp</span>
                                    <input
                                        type="number"
                                        placeholder="Maks"
                                        className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 w-full h-[calc(100vh-4rem)] p-4 md:p-6 lg:p-8 overflow-y-auto">
                    {/* Placeholder Grid Produk */}
                    <div className="w-full min-h-full bg-white border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center p-8 transition-colors hover:border-slate-300 hover:bg-slate-50/50">
                        <div className="flex items-center gap-2 px-6 py-4 bg-slate-100 rounded-xl text-slate-500">
                            <LayoutGrid className="w-5 h-5 flex-shrink-0 text-slate-400" />
                            <span className="text-sm font-semibold tracking-wide">Area Grid Produk</span>
                        </div>
                    </div>
                </main>

            </div>
        </div>
    );
}
