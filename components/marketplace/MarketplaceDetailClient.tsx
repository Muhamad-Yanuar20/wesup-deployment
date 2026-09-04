"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Tag, Users, Share2, ArrowLeft } from "lucide-react";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import { useToast } from "@/components/ui/GlobalToast";
import PickupLocationMapClient from "./PickupLocationMapClient";
import LocationConsentCheckbox from "./LocationConsentCheckbox";

const rupiahFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const closingTimeFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

function formatClosingTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Waktu tutup belum tersedia" : closingTimeFormatter.format(date);
}

function buildWhatsAppShareUrl(item: MarketplaceItem, absoluteUrl: string): string {
  const message = `${item.title} — Rp${item.currentTierPrice.toLocaleString("id-ID")}\nLihat penawaran: ${absoluteUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export interface MarketplaceDetailClientProps {
  item: MarketplaceItem;
}

export default function MarketplaceDetailClient({ item }: MarketplaceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [consentGiven, setConsentGiven] = useState(false);

  const progress = item.targetQuantity <= 0 ? 0 : Math.min(100, Math.round((item.registeredQuantity / item.targetQuantity) * 100));
  const absoluteUrl = typeof window !== "undefined" ? window.location.href : `/marketplace/${item.slug}`;
  const shareUrl = buildWhatsAppShareUrl(item, absoluteUrl);

  function handleJoin() {
    if (!consentGiven) return;
    toast("Pendaftaran berhasil! Silakan selesaikan pembayaran di menu Pesanan.", "success");
    router.push("/pesanan");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm h-16">
        <div className="max-w-[1024px] mx-auto w-full h-full px-4 md:px-6 flex items-center gap-3">
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft aria-hidden="true" className="w-5 h-5" />
            <span className="text-sm font-semibold">Kembali ke Marketplace</span>
          </Link>
        </div>
      </header>

      <main className="max-w-[1024px] mx-auto w-full p-4 md:p-6 lg:p-8">
        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="relative w-full aspect-[16/9] bg-slate-100">
            <Image src={item.imageUrl} alt={`Foto produk ${item.title}`} fill sizes="(min-width: 1024px) 768px, 100vw" className="object-cover" />
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 shadow-sm border border-white">
              {item.category}
            </div>
          </div>

          <div className="p-5 md:p-8 flex flex-col gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">{item.title}</h1>
              <p className="mt-2 text-base font-medium text-slate-500">{item.supplierName}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <MapPin aria-hidden="true" className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Titik kumpul Supplier</p>
                  <p className="text-sm text-slate-500">{item.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Clock aria-hidden="true" className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Estimasi & Jarak</p>
                  <p className="text-sm text-slate-500">
                    {item.distanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km • {item.estimatedPickupMinutes} mnt (Pickup)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <MapPin aria-hidden="true" className="w-4 h-4" />
                <span>Lokasi Titik Kumpul</span>
              </div>
              <PickupLocationMapClient
                latitude={item.pickupLatitude}
                longitude={item.pickupLongitude}
                address={item.pickupAddress}
              />
            </div>

            <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                <Tag aria-hidden="true" className="w-4 h-4" />
                <span>Tier Diskon</span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{rupiahFormatter.format(item.currentTierPrice)}</span>
                <span className="text-sm font-medium text-slate-400 line-through mb-1">{rupiahFormatter.format(item.basePrice)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 font-semibold text-blue-700">
                  <Users aria-hidden="true" className="w-4 h-4" />
                  <span>Target Kelompok: {item.registeredQuantity}/{item.targetQuantity} Porsi</span>
                </div>
                <span className="font-bold text-slate-700">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner" role="progressbar" aria-label="Progres target kelompok" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs font-medium text-slate-500">Tutup pendaftaran: {formatClosingTime(item.registrationClosesAt)}</p>
            </div>

            <LocationConsentCheckbox onChange={(checked) => setConsentGiven(checked)} />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleJoin}
                disabled={!consentGiven}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  consentGiven
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              >
                Daftar Sekarang
              </button>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <Share2 aria-hidden="true" className="w-4 h-4" />
                Bagikan via WhatsApp
              </a>
            </div>

            {!consentGiven && (
              <p className="text-xs text-slate-400 -mt-3">
                Centang persetujuan lokasi pengambilan untuk mengaktifkan tombol daftar.
              </p>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
