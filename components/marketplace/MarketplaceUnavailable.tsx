import Link from "next/link";
import { AppPanel } from "@/components/layout/AppPanel";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { availabilityMessage } from "@/lib/marketplace/availability";
import type { MarketplaceAvailability } from "@/lib/marketplace/types";

export default function MarketplaceUnavailable({ title, supplierName, reason }: { title: string; supplierName: string; reason: MarketplaceAvailability["reason"] }) {
  return <AppPanel className="mx-auto max-w-3xl" panelClassName="!py-12 sm:!py-16">
    <div className="max-w-xl space-y-6" role="status">
      <Eyebrow>Penawaran tidak tersedia</Eyebrow>
      <h1 className="break-words font-landing-display text-3xl uppercase leading-tight tracking-[0.03em] md:text-5xl">{title}</h1>
      <p className="text-sm text-wesup-ink-sub">{supplierName}</p>
      <p className="border-l-2 border-wesup-red pl-4 text-lg font-semibold">{availabilityMessage(reason)}</p>
      <p className="text-sm leading-7 text-wesup-ink-sub">Pilih penawaran lain yang masih tersedia. Pesanan yang sudah terdaftar tetap dapat dipantau melalui halaman pesanan Anda.</p>
      <Link href="/marketplace" className="inline-flex min-h-12 items-center justify-center bg-wesup-ink px-6 py-3 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wesup-red">Kembali ke marketplace</Link>
    </div>
  </AppPanel>;
}
