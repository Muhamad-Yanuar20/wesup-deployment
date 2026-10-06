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
      className="scroll-mt-24 border-t border-slate-900/[0.05] bg-wesup-ivory py-24 sm:py-32"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>Alur kerja</Eyebrow>
            <h2 className={`mt-5 max-w-xl ${SECTION_TITLE} text-slate-900`}>
              Dari pendaftaran sampai barang di tangan.
            </h2>
          </Reveal>
          <Reveal delayMs={100}>
            <p className="max-w-lg text-base leading-relaxed text-slate-600 text-pretty sm:text-lg lg:ml-auto">
              Anda tidak perlu menawar sendiri. Cukup gabung, volume digabung dari banyak pembeli,
              dan harga grosir ikut berlaku sampai pintu batch ditutup.
            </p>
          </Reveal>
        </div>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="h-full">
              <Reveal delayMs={index * 90} className="h-full">
                <CardFrame
                  className="h-full bg-slate-900/[0.035] ring-1 ring-slate-900/[0.05]"
                  panelClassName="flex h-full flex-col bg-white p-6 shadow-[inset_0_1px_1px_#ffffff99] sm:p-7"
                  radius={1.75}
                >
                  <div className="flex items-start justify-between">
                    <span className="pt-1 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-slate-500">
                      Langkah 0{index + 1}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wesup-ivory ring-1 ring-slate-900/10">
                      <step.icon
                        className="h-5 w-5 text-slate-800"
                        strokeWidth={1.25}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <h3 className="mt-7 font-landing-display text-xl font-medium tracking-[-0.01em] text-slate-900 text-balance">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.7] text-slate-600 text-pretty">
                    {step.body}
                  </p>
                  <div aria-hidden="true" className="mt-auto h-6" />
                  <div
                    aria-hidden="true"
                    className="flex items-center justify-between border-t border-slate-900/[0.06] pt-4"
                  >
                    <span className="font-landing-display text-2xl tabular-nums text-slate-300">
                      0{index + 1}
                    </span>
                    <span className="h-px w-10 bg-slate-900/15" />
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
