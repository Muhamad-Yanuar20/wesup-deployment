import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MarketplaceItem } from "@/lib/marketplace/types";

const rupiahFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const closingTimeFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
export interface ProductCardProps { item: MarketplaceItem; featured?: boolean; }
function formatClosingTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Waktu tutup belum tersedia" : closingTimeFormatter.format(date);
}

export default function ProductCard({ item, featured = false }: ProductCardProps) {
  const progress = item.targetQuantity <= 0 ? 0 : Math.min(100, Math.round((item.registeredQuantity / item.targetQuantity) * 100));
  return <Link href={`/marketplace/${encodeURIComponent(item.id)}`} className="group block h-full min-w-0 border border-wesup-ink/15 bg-wesup-paper-sub p-1.5 transition-colors duration-500 wesup-ease hover:border-wesup-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">
    <article className={`flex h-full min-w-0 flex-col border border-wesup-ink/10 bg-wesup-paper tabular-nums ${featured ? "md:grid md:grid-cols-[0.9fr_1.1fr]" : ""}`}>
      <div className={`relative aspect-[4/3] overflow-hidden bg-wesup-paper-sub ${featured ? "md:aspect-auto md:min-h-96" : "sm:aspect-[16/10]"}`}>
        <Image src={item.imageUrl} alt={`Foto produk ${item.title}`} fill sizes="(min-width: 1280px) 25vw, (min-width: 768px) 40vw, 100vw" className="object-cover transition-transform duration-500 wesup-ease motion-safe:group-hover:scale-[1.02]" />
        <span className="absolute left-3 top-3 border border-wesup-ink/15 bg-wesup-paper px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink">{item.category}</span>
      </div>
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5">
        <div><p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{item.supplierName}</p><h3 className="mt-3 break-words font-landing-display text-xl font-normal uppercase leading-[1.15] tracking-[0.03em] text-wesup-ink">{item.title}</h3></div>
        <dl className="divide-y divide-wesup-ink/15 border-y border-wesup-ink/15 text-sm">
          <SpecRow label="Jarak">{item.distanceKm === null ? "Jarak belum tersedia" : `${item.distanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`}</SpecRow>
          <SpecRow label="Pickup">{item.estimatedPickupMinutes === null ? "Estimasi belum tersedia" : `${item.estimatedPickupMinutes} mnt (Pickup)`}</SpecRow>
          <SpecRow label="Tutup">{formatClosingTime(item.registrationClosesAt)}</SpecRow>
        </dl>
        <div className="mt-auto"><p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{item.policyVersion === 2 ? "Estimasi harga · belum final" : "Tier Diskon"}</p><div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-landing-display text-2xl tracking-tight text-wesup-ink">{rupiahFormatter.format(item.currentTierPrice)}</span><span className="text-sm text-wesup-ink-sub line-through">{rupiahFormatter.format(item.basePrice)}</span></div></div>
        <div className="space-y-3 border-t border-wesup-ink/15 pt-4"><div className="flex flex-wrap justify-between gap-2 font-mono text-[0.6875rem] uppercase leading-5 tracking-[0.08em]"><span>{item.policyVersion === 2 ? "Terkumpul" : "Target Kelompok"}: {item.registeredQuantity}/{item.policyVersion === 2 ? item.capacityQuantity : item.targetQuantity} {item.unit ?? "Porsi"}</span><span>{progress}%</span></div><div className="h-px w-full bg-wesup-ink/20" role="progressbar" aria-label="Progres target kelompok" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-[3px] w-full origin-left bg-wesup-red transition-transform duration-500 wesup-ease motion-reduce:transition-none" style={{ transform: `translateY(-1px) scaleX(${progress / 100})` }} /></div></div>
        {item.policyVersion === 2 && <div className="space-y-2 text-xs leading-6 text-wesup-ink-sub"><p>Harga dasar {rupiahFormatter.format(item.basePrice)} / {item.unit}. Diskon dapat berubah.</p><p>Sisa {Math.max(0, (item.capacityQuantity ?? 0) - item.registeredQuantity)} {item.unit}</p><p>{item.pickupAddress}</p><p>Ambil {item.pickupStartsAt ? formatClosingTime(item.pickupStartsAt) : "—"} – {item.pickupEndsAt ? formatClosingTime(item.pickupEndsAt) : "—"} WIB</p></div>}
        <span className="flex min-h-11 items-center justify-between gap-3 border-t border-wesup-ink/15 pt-3 text-sm font-semibold text-wesup-ink">Lihat penawaran<span className="flex size-8 items-center justify-center border border-wesup-ink/20 transition-transform duration-500 wesup-ease group-hover:translate-x-0.5"><ArrowRight strokeWidth={1.5} aria-hidden="true" className="size-4" /></span></span>
      </div>
    </article>
  </Link>;
}
function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[4.5rem_1fr]"><dt className="py-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{label}</dt><dd className="min-w-0 border-l border-wesup-ink/15 py-3 pl-3 text-xs leading-5 text-wesup-ink">{children}</dd></div>;
}
