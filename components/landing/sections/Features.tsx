import { MapPin, ShieldCheck, TrendingDown, Truck } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { CardFrame } from "@/components/landing/CardFrame";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { SECTION_TITLE } from "@/components/landing/section-style";
import { formatRupiah, lockedTierForKg, TARGET_REGISTERED_KG } from "@/lib/landing";

export function Features() {
  const lockedTier = lockedTierForKg(TARGET_REGISTERED_KG);

  return (
    <section id="features" className="scroll-mt-24 bg-white py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>Keunggulan</Eyebrow>
            <h2 className={`mt-5 max-w-2xl ${SECTION_TITLE} text-slate-900`}>
              Harga grosir untuk skala UMKM, tanpa mengorbankan jaminan.
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Lead benefit — the statement card */}
          <Reveal className="sm:col-span-2 lg:col-span-3">
            <CardFrame
              className="h-full bg-slate-900/[0.06] ring-1 ring-slate-900/[0.06]"
              panelClassName="relative flex h-full flex-col justify-between overflow-hidden bg-slate-950 p-7 sm:p-10"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-wesup-kraft/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -right-16 text-white opacity-[0.05]"
              >
                <TrendingDown className="h-72 w-72" strokeWidth={1} />
              </div>
              <div className="relative">
                <Eyebrow tone="light">Harga berjenjang</Eyebrow>
                <h3 className="mt-5 max-w-md font-landing-display text-2xl font-medium leading-tight tracking-[-0.02em] text-white text-balance sm:text-3xl">
                  Harga turun saat volume naik.
                </h3>
                <p className="mt-4 max-w-md text-base leading-[1.7] text-slate-400 text-pretty">
                  Volume antar-UMKM digabung dalam satu batch. Semakin banyak yang ikut, semakin
                  murah harga per kilogram Anda —{" "}
                  <strong className="font-semibold text-white">tanpa perlu skala bisnis besar</strong>.
                </p>
              </div>
              <div className="relative mt-8 inline-flex w-fit flex-wrap items-center gap-x-4 gap-y-2 rounded-full bg-white/5 py-2 pl-5 pr-3 ring-1 ring-white/10">
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-slate-400">
                  Batch berjalan
                </span>
                <span className="font-landing-display text-xl font-medium tabular-nums text-white">
                  {formatRupiah(lockedTier.unitPrice)}
                  <span className="text-sm font-normal text-slate-400">/kg</span>
                </span>
                <span className="rounded-full bg-wesup-kraft/20 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-amber-50 ring-1 ring-wesup-kraft/50">
                  {lockedTier.label}
                </span>
              </div>
            </CardFrame>
          </Reveal>

          {/* Escrow card */}
          <Reveal delayMs={110} className="lg:col-span-2">
            <CardFrame
              className="h-full bg-slate-900/[0.035] ring-1 ring-slate-900/[0.05]"
              panelClassName="flex h-full flex-col bg-wesup-ivory p-7 shadow-[inset_0_1px_1px_#ffffff99] sm:p-8"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-600/15">
                <ShieldCheck className="h-5 w-5 text-emerald-700" strokeWidth={1.25} aria-hidden="true" />
              </span>
              <h3 className="mt-7 font-landing-display text-xl font-medium tracking-[-0.01em] text-slate-900">
                Dana ditahan 24 jam
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.7] text-slate-600 text-pretty">
                Uang Anda ditahan di <strong className="font-semibold text-slate-900">escrow</strong>{" "}
                dan baru diteruskan ke supplier{" "}
                <strong className="font-semibold text-slate-900">1×24 jam</strong> setelah Anda
                mengonfirmasi barang sesuai pesanan.
              </p>
            </CardFrame>
          </Reveal>

          {/* Self-pickup card */}
          <Reveal delayMs={200} className="lg:col-span-2">
            <CardFrame
              className="h-full bg-slate-900/[0.035] ring-1 ring-slate-900/[0.05]"
              panelClassName="flex h-full flex-col bg-wesup-ivory p-7 shadow-[inset_0_1px_1px_#ffffff99] sm:p-8"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-900/10">
                <Truck className="h-5 w-5 text-slate-800" strokeWidth={1.25} aria-hidden="true" />
              </span>
              <h3 className="mt-7 font-landing-display text-xl font-medium tracking-[-0.01em] text-slate-900">
                Tanpa ongkir last-mile
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.7] text-slate-600 text-pretty">
                Ambil langsung di titik kumpul supplier.{" "}
                <strong className="font-semibold text-slate-900">Self-pickup</strong> memangkas biaya
                kirim dan waktu tunggu — pengadaan lebih murah, sepenuhnya di tangan Anda.
              </p>
            </CardFrame>
          </Reveal>

          {/* Kraft strip */}
          <Reveal delayMs={150} className="sm:col-span-2 lg:col-span-5">
            <CardFrame
              className="bg-wesup-kraft/25 ring-1 ring-wesup-kraft/40"
              panelClassName="flex flex-col gap-4 bg-wesup-kraft/15 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9 sm:py-6"
            >
              <p className="font-landing-display text-lg font-medium leading-snug text-slate-900 text-pretty sm:text-xl">
                Beroperasi di Bandung — serah terima di titik kumpul supplier pilihan Anda.
              </p>
              <span className="inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-slate-700">
                <MapPin className="h-4 w-4 text-slate-800" strokeWidth={1.5} aria-hidden="true" />
                Self-pickup
              </span>
            </CardFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
