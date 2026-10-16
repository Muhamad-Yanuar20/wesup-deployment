import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { CardFrame } from "@/components/landing/CardFrame";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { SECTION_TITLE } from "@/components/landing/section-style";

const TRUST = ["Bayar sekali lewat QRIS", "Dana aman di escrow", "Ambil sendiri di Bandung"];

export function ClosingCta() {
  return (
    <section className="relative px-4 pb-28 sm:px-6 sm:pb-36 lg:px-8">
      <Reveal>
        <CardFrame
          className="relative mx-auto max-w-6xl overflow-hidden border border-wesup-ink/10 bg-wesup-paper-sub"
          panelClassName="relative overflow-hidden bg-wesup-paper px-6 py-20 text-center sm:px-12 sm:py-28"
          frameRem={0.5}
        >
          <div className="relative mx-auto max-w-2xl">
            <Eyebrow tone="light" trailingRule>
              Waktu terbatas
            </Eyebrow>
            <h2 className={`mt-5 ${SECTION_TITLE} text-wesup-ink`}>Beli bareng, bayar lebih murah.</h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-[1.7] text-wesup-ink-sub text-pretty sm:text-lg">
              Daftar gratis, pilih batch yang sedang terbuka, dan kunci harga sebelum pintu ditutup.
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register?role=umkm"
                className="group inline-flex min-h-12 items-center justify-center border border-wesup-ink bg-wesup-ink py-2 pl-7 pr-3 text-[0.9375rem] font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:translate-x-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              >
                Mulai Belanja Bersama
                <span aria-hidden="true" className="ml-4 inline-flex h-9 w-9 items-center justify-center">
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex min-h-12 items-center justify-center border border-wesup-ink/20 bg-wesup-paper px-8 text-[0.9375rem] font-semibold text-wesup-ink transition-colors duration-500 hover:bg-wesup-paper-sub focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
              >
                Buka Marketplace
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-wesup-ink-sub">
              {TRUST.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-wesup-red" strokeWidth={1.5} aria-hidden="true" />
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
