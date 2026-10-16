import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { StrikeLevel } from "@/lib/payments/types";

const STRIKE_POLICY: Record<
  StrikeLevel,
  { label: string; description: string }
> = {
  1: {
    label: "Peringatan WhatsApp",
    description:
      "Pelanggaran ke-1. Hit & Run terdeteksi — peringatan otomatis dikirim, akun tetap aktif.",
  },
  2: {
    label: "Suspend Sementara 7 Hari",
    description:
      "Pelanggaran ke-2. Akun ditangguhkan 7 hari terhitung sejak batas akhir Payment Window.",
  },
  3: {
    label: "Suspend Permanen",
    description:
      "Pelanggaran ke-3. Akun ditangguhkan permanen dan kehilangan akses ke order/batch baru.",
  },
};

export default function HitAndRunBanner({
  strikes,
}: {
  strikes: StrikeLevel;
}) {
  const current = STRIKE_POLICY[strikes];

  return (
    <section
      role="alert"
      aria-label="Peringatan sanksi Hit and Run"
      className="relative border border-wesup-red bg-wesup-paper p-4 pl-6"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-wesup-red" />
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center border border-wesup-red text-wesup-red"><ShieldAlert className="size-5" strokeWidth={1.5} /></span>
        <div className="min-w-0">
          <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">
            Pembayaran terlewat — Sanksi Hit &amp; Run
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-wesup-ink-sub">
            Jendela pembayaran sudah ditutup dan tagihan tidak dapat diproses.
            Sistem menjatuhkan sanksi berjenjang bagi UMKM yang gagal membayar.
          </p>

          <ol className="mt-3 divide-y divide-wesup-ink/10 border border-wesup-ink/15">
            {([1, 2, 3] as const).map((level) => {
              const policy = STRIKE_POLICY[level];
              const isCurrent = level === strikes;
              return (
                <li
                  key={level}
                  className={`flex items-start gap-2 px-3 py-2 text-xs ${isCurrent ? "bg-wesup-paper-sub font-bold text-wesup-ink" : "text-wesup-ink-sub"}`}
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className={`mt-0.5 size-3.5 shrink-0 ${isCurrent ? "text-wesup-red" : "text-wesup-ink-sub/50"}`}
                    strokeWidth={1.5}
                  />
                  <span>
                    <span className="tabular-nums">{level}.</span> {policy.label}
                    {isCurrent ? (
                      <span className="ml-1 inline-flex items-center bg-wesup-red px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper">{current.description}</span>
                    ) : (
                      <span className="text-wesup-ink-sub/70"> — {policy.description}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
