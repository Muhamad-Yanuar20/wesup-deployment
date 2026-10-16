import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/Reveal";
import { CardFrame } from "@/components/landing/CardFrame";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { SECTION_TITLE } from "@/components/landing/section-style";
import {
  TARGET_QUOTA_KG,
  TARGET_REGISTERED_KG,
  TIERS,
  formatKg,
  formatRupiah,
  lockedTierForKg,
  nextTier,
} from "@/lib/landing";

interface Stat {
  /** Accent hairline colour above the value. */
  rule: string;
  value: ReactNode;
  label: string;
}

export function BatchManifest() {
  // Derived from the same constants the hero scene uses, so the two sections
  // can never disagree about the current batch.
  const lockedTier = lockedTierForKg(TARGET_REGISTERED_KG);
  const upcomingTier = nextTier(TARGET_QUOTA_KG);

  const stats: Stat[] = [
    {
      rule: "bg-wesup-red",
      value: (
        <>
          {formatKg(TARGET_REGISTERED_KG)}
          <span className="text-lg text-wesup-ink-sub sm:text-xl"> / {formatKg(TARGET_QUOTA_KG)} kg</span>
        </>
      ),
      label: "Terkumpul · kuota",
    },
    {
      rule: "bg-wesup-red",
      value: (
        <>
          {formatRupiah(lockedTier.unitPrice)}
          <span className="text-lg text-wesup-ink-sub sm:text-xl">/kg</span>
        </>
      ),
      label: `Harga terkunci · ${lockedTier.label}`,
    },
    {
      rule: "bg-wesup-red",
      value: (
        <>
          {formatKg(upcomingTier.minQuantityKg)}
          <span className="text-lg text-wesup-ink-sub sm:text-xl"> kg</span>
        </>
      ),
      label: `Membuka ${upcomingTier.label} · ${formatRupiah(upcomingTier.unitPrice)}`,
    },
    {
      rule: "bg-wesup-red",
      value: <>1×24 jam</>,
      label: "Dana ditahan escrow setelah barang diterima",
    },
  ];

  return (
    <section
      aria-label="Ringkasan batch berjalan"
      className="relative overflow-hidden border-t border-wesup-ink/10 px-4 py-24 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="container relative mx-auto">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>Manifest · Batch berjalan</Eyebrow>
            <h2 className={`mt-5 ${SECTION_TITLE} text-wesup-ink`}>
              Terkumpul {formatKg(TARGET_REGISTERED_KG)} dari {formatKg(TARGET_QUOTA_KG)} kg — harga
              terkunci di {lockedTier.label}.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-[1.7] text-wesup-ink-sub text-pretty sm:text-lg">
              {upcomingTier.label} ({formatRupiah(upcomingTier.unitPrice)}/kg) terbuka saat volume
              mencapai {formatKg(upcomingTier.minQuantityKg)} kg. Dana Anda tidak bergerak sebelum
              barang diterima.
            </p>
          </Reveal>
        </div>

        <Reveal delayMs={120}>
          <CardFrame
            className="mt-10 border border-wesup-ink/10 bg-wesup-paper-sub sm:mt-14"
            panelClassName="overflow-hidden bg-wesup-paper"
          >
            {/* dt precedes dd per the dl content model; flex `order` keeps the
                value visually above its label. The decorative rule lives inside
                the dd so no non-dt/dd element sits in the dl. */}
            <dl className="grid grid-cols-2 gap-px bg-wesup-ink/10 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col bg-wesup-paper p-6 sm:p-8">
                  <dt className="order-2 mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                    {stat.label}
                  </dt>
                  <dd className="order-1 font-landing-display text-2xl font-medium tabular-nums tracking-tight text-wesup-ink sm:text-3xl">
                    <span aria-hidden="true" className={`mb-4 block h-px w-8 ${stat.rule}`} />
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardFrame>

          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
            {TIERS.map((tier, index) => (
              <span key={tier.label} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">·</span>}
                {tier.label} {formatRupiah(tier.unitPrice)}/kg
              </span>
            ))}
            <span aria-hidden="true">·</span>
            <span>Terkunci saat pendaftaran ditutup</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
