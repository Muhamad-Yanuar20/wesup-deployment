import React from 'react';
import {
    Pencil,
    Trash2,
    Clock,
    MapPin,
    TrendingDown,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Package,
    CreditCard,
    Truck
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function BatchDetailPage() {
    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* ACTION TOP RIGHT - HAPUS KATALOG */}
                <div className="flex justify-end">
                    <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                        <Trash2 size={16} />
                        <span>Hapus Katalog</span>
                    </button>
                </div>

                {/* HEADER DETAIL */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 size={14} />
                                    <span>Sedang Berjalan</span>
                                </span>
                                <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                                    <Package size={14} />
                                    <span>Sembako</span>
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Beras Rojolele 5kg - Batch 04</h1>
                            <p className="text-sm text-gray-500 mt-1">ID: BATCH-20260821-004</p>
                        </div>

                        <button className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-blue-600 bg-white border-2 border-blue-600 hover:bg-blue-50 rounded-lg transition-colors w-full md:w-auto shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                            <Pencil size={18} />
                            <span>Edit Penawaran</span>
                        </button>
                    </div>
                </div>

                {/* INFO CARDS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Card 1: Skema Tier Diskon */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-4 text-gray-800 font-semibold border-b border-gray-100 pb-3">
                            <TrendingDown size={18} className="text-blue-500" />
                            <span>Skema Tier Diskon</span>
                        </div>

                        <div className="space-y-4 flex-grow flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className="text-xs text-gray-500 font-medium tracking-wide">Harga Dasar</span>
                                        <p className="text-lg font-medium text-gray-400 line-through mt-0.5">Rp 75.000</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-blue-600 font-bold tracking-wide">Target Diskon</span>
                                        <p className="text-2xl font-bold text-gray-900 mt-0.5">Rp 68.000</p>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <div className="flex justify-between text-xs text-gray-600 mb-2 font-medium">
                                        <span className="flex items-center justify-center gap-1.5"><Package size={12} className="text-blue-500" /> 24 / 50 Pcs</span>
                                        <span>48%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out" style={{ width: '48%' }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 mt-4 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                                <AlertCircle size={14} className="shrink-0" />
                                <span className="text-xs font-medium">Butuh 26 pcs lagi untuk capai target</span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Timeline Absolut */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-4 text-gray-800 font-semibold border-b border-gray-100 pb-3">
                            <Clock size={18} className="text-indigo-500" />
                            <span>Timeline Batch</span>
                        </div>

                        <div className="space-y-5 text-sm flex-grow">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 bg-indigo-50 p-2 rounded-lg text-indigo-600 border border-indigo-100">
                                    <Calendar size={16} />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 font-medium block mb-1 tracking-wide">Waktu Buka - Tutup</span>
                                    <p className="text-gray-900 font-semibold">21 Aug 2026 - 28 Aug 2026</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 bg-rose-50 p-2 rounded-lg text-rose-600 border border-rose-100">
                                    <CreditCard size={16} />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 font-medium block mb-1 tracking-wide">Batas Pembayaran</span>
                                    <p className="text-gray-900 font-semibold">29 Aug 2026, 15:00 WIB</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 bg-emerald-50 p-2 rounded-lg text-emerald-600 border border-emerald-100">
                                    <Truck size={16} />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 font-medium block mb-1 tracking-wide">Estimasi Ready</span>
                                    <p className="text-gray-900 font-semibold">01 Sep 2026</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Titik Kumpul */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col lg:col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4 text-gray-800 font-semibold border-b border-gray-100 pb-3">
                            <MapPin size={18} className="text-orange-500" />
                            <span>Lokasi Pengambilan</span>
                        </div>

                        <div className="flex-grow flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 bg-orange-50 p-2 rounded-lg text-orange-600 border border-orange-100 shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div className="text-sm text-gray-700 leading-relaxed">
                                    <span className="font-semibold block text-gray-900 text-base mb-1">Gudang Utama Jakarta</span>
                                    Jl. Pintu Air Raya No. 42, Pasar Baru, Sawah Besar, Jakarta Pusat 10710
                                </div>
                            </div>

                            {/* Peta Statis Sederhana */}
                            <div className="w-full h-32 bg-slate-100 rounded-lg mt-auto border border-slate-200 relative overflow-hidden flex items-center justify-center group cursor-pointer transition-colors hover:border-orange-300 hover:shadow-inner">
                                {/* Simulated map graphic grid using CSS */}
                                <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwdjIwSDIwVjBIMHptMTkgMTlIMVYxSDE5djE4eiIgZmlsbD0iI2QxZDVkYiI+PC9wYXRoPgo8L3N2Zz4=')]"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-100/50 to-transparent"></div>

                                <div className="relative flex flex-col items-center">
                                    <div className="text-orange-500 bg-orange-100 p-2 rounded-full drop-shadow-md mb-2">
                                        <MapPin size={24} className="fill-orange-100" />
                                    </div>
                                    <span className="flex items-center justify-center gap-1.5 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-gray-700 border border-gray-200 shadow-sm transition-transform group-hover:scale-105 group-hover:text-orange-600">
                                        <MapPin size={12} />
                                        <span>Lihat Rute</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
