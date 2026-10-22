import type { Metadata } from "next";
import { AppPanel } from "@/components/layout/AppPanel";
import { PageHeader } from "@/components/layout/PageHeader";
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

        <div className="mt-8"><PageHeader title="Pilih koordinat lokasi" eyebrow="Laboratorium / Peta" description="Pilih titik langsung pada peta, atau gunakan lokasi perangkat Anda. Koordinat terpilih ditampilkan untuk membantu pemeriksaan lokasi." /></div>
        <AppPanel panelClassName="!p-0"><LeafletDemoClient /></AppPanel>
      </div>
    </main>
  );
}
