import { Boxes, PackageCheck, QrCode, Users } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { CardFrame } from "@/components/landing/CardFrame";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { SECTION_TITLE } from "@/components/landing/section-style";

const STEPS = [
  {
    icon: Boxes,
    title: "Pilih produk",
    body: "Telusuri penawaran bahan baku dari supplier terverifikasi di Bandung.",
  },
  {
    icon: Users,
    title: "Gabung batch",
    body: "Daftar sebelum pintu ditutup. Volume dari banyak UMKM digabung jadi satu muatan.",
  },
  {
    icon: QrCode,
    title: "Harga terkunci, bayar QRIS",
    body: "Saat pendaftaran ditutup, harga per kg dikunci. Bayar sekali lewat QRIS.",
  },
  {
    icon: PackageCheck,
    title: "Ambil di titik kumpul",
    body: "Serah terima self-service di supplier. Dana baru diteruskan setelah Anda konfirmasi.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="cara-kerja"
      className="relative scroll-mt-24 overflow-hidden border-t border-wesup-ink/10 py-24 sm:py-32"
    >
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>Alur kerja</Eyebrow>
            <h2 className={`mt-5 max-w-xl ${SECTION_TITLE} text-wesup-ink`}>
              Dari pendaftaran sampai barang di tangan.
            </h2>
          </Reveal>
          <Reveal delayMs={100}>
            <p className="max-w-lg text-base leading-[1.7] text-wesup-ink-sub text-pretty sm:text-lg lg:ml-auto">
              Anda tidak perlu menawar sendiri. Cukup gabung, volume digabung dari banyak pembeli,
              dan harga grosir ikut berlaku sampai pintu batch ditutup.
            </p>
          </Reveal>
        </div>

        <ol className="mt-16 grid border border-wesup-ink/10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="h-full">
              <Reveal delayMs={index * 90} className="h-full">
                <CardFrame
                  frameRem={0}
                  className="h-full border-b border-r border-wesup-ink/10 bg-wesup-paper-sub"
                  panelClassName="relative flex h-full flex-col bg-wesup-paper p-6 sm:p-7"
                >
                  <div className="flex items-start justify-between">
                    <span className="pt-1 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub">
                      Langkah 0{index + 1}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center border border-wesup-ink/20 bg-wesup-paper">
                      <step.icon
                        className="h-5 w-5 text-wesup-ink"
                        strokeWidth={1.25}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <h3 className="mt-7 font-landing-display text-xl font-medium tracking-[-0.01em] text-wesup-ink text-balance">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.7] text-wesup-ink-sub text-pretty">
                    {step.body}
                  </p>
                  <div aria-hidden="true" className="mt-auto h-6" />
                  <div
                    aria-hidden="true"
                    className="flex items-center justify-between border-t border-wesup-ink/10 pt-4"
                  >
                    <span className="font-landing-display text-2xl tabular-nums text-wesup-ink/20">
                      0{index + 1}
                    </span>
                    <span className="h-px w-10 bg-wesup-red" />
                  </div>
                </CardFrame>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
