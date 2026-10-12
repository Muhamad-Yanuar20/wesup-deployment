import { QrCode, ShieldCheck } from "lucide-react";
import type { PaymentResolution } from "@/lib/payments/types";

interface QrisPaymentMockProps {
  resolution: PaymentResolution;
  grossAmount: number;
}

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/**
 * Placeholder statis untuk QRIS Midtrans Sandbox. Blok ini hanya menandakan
 * area QRIS — role pemoles berikutnya menggantinya dengan `qr_code_url`
 * asli dari tabel `payments` + refresh status via webhook listener.
 */
export default function QrisPaymentMock({
  resolution,
  grossAmount,
}: QrisPaymentMockProps) {
  const locked =
    resolution === "waiting" || resolution === "expired" || resolution === "paid";

  return (
    <section
      aria-label="Pembayaran QRIS"
      className="border border-wesup-ink/15 bg-wesup-paper"
    >
      <header className="border-b border-wesup-ink/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <QrCode aria-hidden="true" className="size-4 text-wesup-ink-sub" strokeWidth={1.5} />
          <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">
            Bayar via QRIS
          </h2>
          <span className="ml-auto bg-wesup-paper-sub px-2 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink-sub">
            Midtrans Sandbox
          </span>
        </div>
      </header>

      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <div
          className="relative flex size-44 items-center justify-center border border-dashed border-wesup-ink/30 bg-wesup-paper-sub"
          aria-hidden="true"
        >
          <div className="text-center">
            <QrCode className="mx-auto size-12 text-wesup-ink-sub/60" strokeWidth={1} />
            <p className="mt-2 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink-sub">
              QRIS Placeholder
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">Nominal tagihan</p>
          <p className="mt-1 font-landing-display text-3xl tabular-nums text-wesup-ink">
            {money.format(grossAmount)}
          </p>
        </div>

        <button
          type="button"
          disabled={locked}
          aria-disabled={locked}
          className={`inline-flex w-full items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors duration-500 wesup-ease ${
            locked
              ? "cursor-not-allowed border-wesup-ink/15 bg-wesup-paper-sub text-wesup-ink-sub/60"
              : "border-wesup-ink bg-wesup-ink text-wesup-paper hover:border-wesup-red hover:bg-wesup-red"
          }`}
        >
          <ShieldCheck aria-hidden="true" className="size-4" strokeWidth={1.5} />
          {resolution === "waiting" && "Tunggu jendela pembayaran dibuka"}
          {resolution === "expired" && "Jendela pembayaran sudah ditutup"}
          {resolution === "paid" && "Pembayaran lunas"}
          {resolution === "open" && "Bayar via QRIS"}
        </button>

        <p className="text-center text-[0.6875rem] leading-relaxed text-wesup-ink-sub">
          Pembayaran harus diselesaikan di dalam Payment Window. Di luar jendela,
          API Gatekeeper menolak transaksi dan tombol akan terkunci.
        </p>
      </div>
    </section>
  );
}
