import React from 'react';
import { MapPin, Clock, Tag, Users } from 'lucide-react';

export default function ProductCard() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col h-full cursor-pointer">

            {/* Image Placeholder */}
            <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <span className="text-sm font-medium">Gambar Produk</span>
                </div>
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 shadow-sm border border-white">
                    Grosir UMKM
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1 gap-4">

                {/* Title and Vendor */}
                <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                        Paket Sembako Beras & Minyak Premium
                    </h3>
                    <p className="text-sm font-medium text-slate-500">Koperasi Makmur Abadi</p>
                </div>

                {/* Info Jarak & Estimasi (Sesuai Aturan Flex Gap-2) */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>2.5 km</span>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>15 mnt (Pickup)</span>
                    </div>
                </div>

                {/* Harga Tier Diskon (Sesuai Aturan Flex Gap-2) */}
                <div className="mt-auto pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Tag className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Tier Diskon</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">Rp95.000</span>
                        <span className="text-sm font-medium text-slate-400 line-through mb-1">Rp120.000</span>
                    </div>
                </div>

                {/* Progress Bar Kuota Volume */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-semibold text-blue-700">
                            <Users className="w-4 h-4" />
                            <span>Target Kelompok: 15/20 Porsi</span>
                        </div>
                        <span className="font-bold text-slate-700">75%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-blue-600 rounded-full w-3/4 transition-all duration-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
