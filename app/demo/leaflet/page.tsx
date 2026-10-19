import type { Metadata } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { LeafletDemoClient } from "@/components/demo/LeafletDemoClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo Peta Leaflet",
  description:
    "Demo interaktif pemilihan titik pengambilan Wesup menggunakan Leaflet dan OpenStreetMap.",
};

export default function LeafletDemoPage() {
  return (
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-10 sm:px-6 lg:px-8 text-wesup-ink">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:text-wesup-ink-sub"
        >
          <span aria-hidden="true">←</span>
          Kembali ke beranda
        </Link>

        <header className="mb-8 mt-8 max-w-3xl">
          <span className="inline-flex border border-wesup-ink/15 bg-wesup-paper px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub">
            Test Map
          </span>
          <h1 className="mt-4 text-4xl tracking-tight text-wesup-ink sm:text-5xl font-landing-display font-normal uppercase tracking-[0.04em]">
            Pilih koordinat lokasi 
          </h1>
          <p className="mt-4 text-base leading-7 text-wesup-ink-sub sm:text-lg">
            Klik peta untuk memindahkan titik, bisa pake lokasi user
          </p>
        </header>

        <LeafletDemoClient />
      </div>
    </main>
  );
}
