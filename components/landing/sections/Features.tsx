import type { ReactNode } from "react";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { Reveal } from "@/components/landing/Reveal";
import { SECTION_TITLE } from "@/components/landing/section-style";
import { formatRupiah, lockedTierForKg, TARGET_REGISTERED_KG } from "@/lib/landing";

function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  /* Spec-sheet data row: a mono label column and a value column, split by a
   * full-height vertical rule. The label column is a fixed 14rem on desktop so
   * every value starts on the same tab stop; on phones the two columns share
   * the row. */
  return (
    <div className="grid grid-cols-2 sm:grid-cols-[14rem_1fr]">
      <div className="px-4 py-5 sm:px-6 sm:py-7">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">
          {label}
        </p>
      </div>
      <div className="border-l border-wesup-ink/15 px-4 py-5 sm:px-6 sm:py-7">{children}</div>
    </div>
  );
}

export function Features() {
  const lockedTier = lockedTierForKg(TARGET_REGISTERED_KG);

  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden border-t border-wesup-ink/10 py-24 sm:py-32">
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>Keunggulan</Eyebrow>
            <h2 className={`mt-5 max-w-2xl ${SECTION_TITLE} text-wesup-ink`}>
              Harga grosir untuk skala UMKM, tanpa mengorbankan jaminan.
            </h2>
          </Reveal>
        </div>

        {/* One bordered spec sheet instead of a card grid: the four guarantees
            share a single tabular manual, so the section reads as the terms of
            the offer rather than four competing claims. Every fact is a live
            value — the price row is the actually-locked tier, not copy. */}
        <Reveal className="mt-12 sm:mt-14">
          <div className="divide-y divide-wesup-ink/15 border border-wesup-ink/15 bg-wesup-paper">
            <SpecRow label="Harga berjenjang">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="font-landing-display text-2xl font-medium tabular-nums text-wesup-ink sm:text-3xl">
                  {formatRupiah(lockedTier.unitPrice)}
                  <span className="text-base font-normal text-wesup-ink-sub">/kg</span>
                </p>
                <span className="bg-wesup-red px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper">
                  {lockedTier.label}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-[1.7] text-wesup-ink-sub text-pretty">
                Volume antar-UMKM digabung dalam satu batch. Semakin banyak yang ikut, semakin
                murah per kilogram Anda — tanpa perlu skala bisnis besar.
              </p>
            </SpecRow>

            <SpecRow label="Jaminan pembayaran">
              <p className="font-landing-display text-xl font-medium text-wesup-ink sm:text-2xl">
                Escrow 24 jam
              </p>
              <p className="mt-2 max-w-xl text-sm leading-[1.7] text-wesup-ink-sub text-pretty">
                Dana ditahan dan baru diteruskan ke supplier 1×24 jam setelah Anda mengonfirmasi
                barang sesuai pesanan.
              </p>
            </SpecRow>

            <SpecRow label="Pengiriman">
              <p className="font-landing-display text-xl font-medium text-wesup-ink sm:text-2xl">
                Self-pickup, tanpa ongkir last-mile
              </p>
              <p className="mt-2 max-w-xl text-sm leading-[1.7] text-wesup-ink-sub text-pretty">
                Ambil langsung di titik kumpul supplier — biaya kirim dan waktu tunggu terpangkas,
                pengadaan sepenuhnya di tangan Anda.
              </p>
            </SpecRow>

            <SpecRow label="Cakupan">
              <p className="font-landing-display text-xl font-medium text-wesup-ink sm:text-2xl">
                Bandung
              </p>
              <p className="mt-2 max-w-xl text-sm leading-[1.7] text-wesup-ink-sub text-pretty">
                Serah terima di titik kumpul supplier pilihan.
              </p>
            </SpecRow>
          </div>
        </Reveal>
      </div>
    </section>
  );
}