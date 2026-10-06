import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { CardFrame } from "@/components/landing/CardFrame";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { SECTION_TITLE } from "@/components/landing/section-style";

const TRUST = ["Bayar sekali lewat QRIS", "Dana aman di escrow", "Ambil sendiri di Bandung"];

export function ClosingCta() {
  return (
    <section className="bg-wesup-ivory px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
      <Reveal>
        <CardFrame
          className="relative mx-auto max-w-6xl overflow-hidden bg-slate-900/[0.045] ring-1 ring-slate-900/[0.06]"
          panelClassName="relative overflow-hidden bg-slate-950 px-6 py-16 text-center sm:px-12 sm:py-24"
          radius={2.5}
          frameRem={0.5}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-wesup-kraft/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <Eyebrow tone="light" trailingRule>
              Waktu terbatas
            </Eyebrow>
            <h2 className={`mt-5 ${SECTION_TITLE} text-white`}>Beli bareng, bayar lebih murah.</h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-slate-400 text-pretty sm:text-lg">
              Daftar gratis, pilih batch yang sedang terbuka, dan kunci harga sebelum pintu ditutup.
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register?role=umkm"
                className="group inline-flex min-h-12 items-center rounded-full bg-white py-2 pl-7 pr-2 text-[0.9375rem] font-semibold text-slate-900 shadow-xl shadow-black/25 transition-all duration-500 wesup-ease hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
              >
                Mulai Belanja Bersama
                <span
                  aria-hidden="true"
                  className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white transition-all duration-500 wesup-ease group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 text-[0.9375rem] font-semibold text-white backdrop-blur-sm transition-all duration-500 wesup-ease hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
              >
                Buka Marketplace
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              {TRUST.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.5} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardFrame>
      </Reveal>
    </section>
  );
}
