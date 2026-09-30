import React from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  HandCoins,
  PackageCheck,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  Truck,
  Users,
} from "lucide-react";
import { HeroScene } from "@/components/landing/scene/HeroScene";
import {
  TARGET_QUOTA_KG,
  TARGET_REGISTERED_KG,
  formatKg,
  formatRupiah,
  lockedTierForKg,
  nextTier,
} from "@/lib/landing";

/* ------------------------------------------------------------------ */
/* Static content — kept out of the JSX so copy edits stay one-liners. */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    icon: Boxes,
    title: "Pilih produk",
    body: "Telusuri penawaran bahan baku dari supplier di Bandung.",
  },
  {
    icon: Users,
    title: "Gabung batch",
    body: "Daftar sebelum pintu batch ditutup. Volume dari banyak UMKM digabung.",
  },
  {
    icon: QrCode,
    title: "Harga terkunci, bayar QRIS",
    body: "Saat pendaftaran ditutup, harga per kg terkunci. Bayar sekali lewat QRIS.",
  },
  {
    icon: PackageCheck,
    title: "Ambil di titik kumpul",
    body: "Ambil sendiri dari supplier. Dana baru diteruskan setelah Anda konfirmasi.",
  },
] as const;

export default async function Home() {
  // The proxy attaches a `strict-dynamic` + nonce CSP to every public document.
  // Next.js only stamps nonces onto its script tags while rendering per
  // request; a statically prerendered page ships nonce-less tags and is
  // blocked by its own policy. Opting in keeps the landing scene (and every
  // other client interaction) authorized to load.
  await connection();

  // Stats are derived from the same constants the hero scene uses, so the two
  // sections can never disagree about the current batch.
  const lockedTier = lockedTierForKg(TARGET_REGISTERED_KG);
  const upcomingTier = nextTier(TARGET_QUOTA_KG);

  return (
    <div className="relative flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/60 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
            <span className="rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 p-1.5 shadow-sm shadow-blue-600/30 ring-1 ring-inset ring-white/20">
              <ShoppingBag className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-900">Wesup</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {[
              { href: "#cara-kerja", label: "Cara kerja" },
              { href: "#features", label: "Keunggulan" },
              { href: "/beranda-umkm", label: "Panduan UMKM" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden min-h-11 items-center rounded-full px-4 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:inline-flex"
            >
              Masuk
            </Link>
            <Link
              href="/register?role=umkm"
              className="inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Mulai Bergabung
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Scroll-scrubbed scene: untouched position, wrapper and props. */}
        <HeroScene />

        {/* ---------------------- Live batch snapshot ---------------------- */}
        <section
          aria-label="Ringkasan batch berjalan"
          className="relative bg-gradient-to-b from-white to-slate-50 px-4 pb-6 pt-16 sm:px-6 sm:pt-24 lg:px-8"
        >
          <div className="container mx-auto">
            <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-3xl bg-slate-200/70 shadow-[0_20px_60px_-24px_rgba(30,64,175,0.35)] ring-1 ring-slate-200/80 lg:grid-cols-4">
              {[
                {
                  value: `${formatKg(TARGET_REGISTERED_KG)} kg`,
                  label: `terkumpul dari target ${formatKg(TARGET_QUOTA_KG)} kg`,
                  tone: "text-blue-700",
                },
                {
                  value: `${formatRupiah(lockedTier.unitPrice)}/kg`,
                  label: `harga terkunci di ${lockedTier.label}`,
                  tone: "text-emerald-700",
                },
                {
                  value: `${formatKg(upcomingTier.minQuantityKg)} kg`,
                  label: `volume untuk membuka ${upcomingTier.label}`,
                  tone: "text-slate-900",
                },
                {
                  value: "1×24 jam",
                  label: "dana ditahan escrow setelah barang diterima",
                  tone: "text-slate-900",
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/90 p-5 backdrop-blur-sm sm:p-7">
                  <dd className={`font-landing-display text-2xl font-medium tabular-nums tracking-tight sm:text-3xl ${stat.tone}`}>
                    {stat.value}
                  </dd>
                  <dt className="mt-1.5 text-sm leading-snug text-slate-600 text-pretty">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------------------- How it works ---------------------------- */}
        <section id="cara-kerja" className="scroll-mt-24 bg-slate-50 py-20 sm:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
              <h2 className="font-landing-display text-3xl font-medium tracking-[-0.025em] text-slate-900 text-balance sm:text-5xl">
                Empat langkah dari daftar sampai barang di tangan
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600 text-pretty">
                Anda tidak perlu menawar sendiri. Cukup gabung, lalu harga grosir ikut berlaku.
              </p>
            </div>

            <ol className="relative mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {/* connector line, desktop only */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[12%] right-[12%] top-[2.35rem] hidden h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent lg:block"
              />
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-3xl bg-gradient-to-b from-white to-white/60 p-px shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]"
                >
                  <div className="h-full rounded-[calc(1.5rem-1px)] border border-slate-200/70 bg-white p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-4 ring-slate-50">
                        <step.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="font-landing-display text-sm font-medium tabular-nums text-slate-500">
                        Langkah {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-0.015em] text-slate-900 text-balance">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[0.9375rem] leading-[1.65] text-slate-600 text-pretty">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------- Value proposition ----------------------------- */}
        <section id="features" className="scroll-mt-24 bg-white py-20 sm:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
              <h2 className="mx-auto max-w-2xl font-landing-display text-3xl font-medium tracking-[-0.025em] text-slate-900 text-balance sm:text-5xl">
                Harga grosir untuk skala UMKM
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 text-pretty">
                Volume digabung dari banyak pembeli, harga turun otomatis, dan dana Anda tidak bergerak
                sebelum barang benar-benar diterima.
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
              {/* Feature 1 — the lead benefit gets the most space */}
              <article className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 p-8 text-white shadow-[0_24px_60px_-28px_rgba(30,64,175,0.7)] sm:p-10 lg:col-span-3">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl"
                />
                <div className="pointer-events-none absolute -bottom-10 -right-10 text-white opacity-[0.06]" aria-hidden="true">
                  <TrendingDown className="h-72 w-72" />
                </div>
                <div className="relative">
                  <span className="inline-flex rounded-2xl bg-white/15 p-3.5 ring-1 ring-white/25 backdrop-blur-sm">
                    <TrendingDown className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h3 className="mt-6 max-w-md font-landing-display text-2xl font-medium leading-tight tracking-[-0.02em] text-balance sm:text-3xl">
                    Harga turun saat volume naik
                  </h3>
                  <p className="mt-4 max-w-md text-base leading-[1.7] text-blue-50/90 text-pretty">
                    Pembelian antar-UMKM digabung dalam satu batch. Semakin banyak yang ikut, semakin murah
                    harga per satuan Anda — <strong className="font-semibold text-white">tanpa perlu skala bisnis besar</strong>.
                  </p>
                  <div className="mt-8 inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/20 backdrop-blur-md">
                    <span className="text-sm text-blue-100">Batch berjalan</span>
                    <span className="font-landing-display text-xl font-medium tabular-nums">
                      {formatRupiah(lockedTier.unitPrice)}
                      <span className="text-sm font-normal text-blue-100">/kg</span>
                    </span>
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                      {lockedTier.label}
                    </span>
                  </div>
                </div>
              </article>

              <div className="grid gap-5 lg:col-span-2 lg:gap-6">
                {/* Feature 2 */}
                <article className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.25)] sm:p-8">
                  <div className="pointer-events-none absolute -right-10 -top-10 text-emerald-600 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.08]" aria-hidden="true">
                    <ShieldCheck className="h-44 w-44" />
                  </div>
                  <span className="inline-flex rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.015em] text-slate-900">Dana ditahan 24 jam</h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.7] text-slate-600 text-pretty">
                    Dana Anda ditahan di <strong className="font-semibold text-slate-900">escrow</strong> dan baru
                    diteruskan ke supplier <strong className="font-semibold text-slate-900">1x24 jam</strong> setelah
                    Anda mengonfirmasi barang sesuai pesanan.
                  </p>
                </article>

                {/* Feature 3 */}
                <article className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.25)] sm:p-8">
                  <div className="pointer-events-none absolute -right-10 -top-10 text-purple-600 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.08]" aria-hidden="true">
                    <Truck className="h-44 w-44" />
                  </div>
                  <span className="inline-flex rounded-2xl bg-purple-50 p-3 ring-1 ring-purple-100">
                    <Truck className="h-6 w-6 text-purple-600" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.015em] text-slate-900">Tanpa ongkir last-mile</h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.7] text-slate-600 text-pretty">
                    Ambil langsung di titik kumpul supplier. <strong className="font-semibold text-slate-900">Self-pickup</strong>{" "}
                    memangkas biaya kirim dan waktu tunggu, sehingga pengadaan lebih murah dan sepenuhnya di tangan Anda.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------- Closing CTA ------------------------------- */}
        <section className="bg-white px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-center shadow-[0_30px_80px_-30px_rgba(2,6,23,0.8)] sm:px-12 sm:py-20">
            <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-600/30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <HandCoins className="mx-auto h-9 w-9 text-emerald-300" aria-hidden="true" />
              <h2 className="mt-5 font-landing-display text-3xl font-medium tracking-[-0.025em] text-white text-balance sm:text-5xl">
                Belanja bahan baku bareng, bayar lebih murah
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-300 text-pretty sm:text-lg">
                Daftar gratis, pilih batch yang sedang terbuka, dan kunci harga sebelum pintu ditutup.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/register?role=umkm"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[0.9375rem] font-semibold text-slate-900 shadow-lg shadow-blue-500/20 transition-transform hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
                >
                  Mulai Hemat Bersama
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/5 px-8 text-[0.9375rem] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
                >
                  Lihat Penawaran
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
                {["Bayar sekali lewat QRIS", "Dana aman di escrow", "Ambil sendiri di Bandung"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* -------------------------------- Footer -------------------------------- */}
      <footer className="mt-auto border-t border-slate-200 bg-slate-50 py-12 pb-16 md:py-12">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-600 p-1">
              <ShoppingBag className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold text-slate-900">Wesup</span>
          </div>
          <p className="text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Wesup · Pembelian kolektif bahan baku UMKM Bandung.
          </p>
        </div>
      </footer>
    </div>
  );
}