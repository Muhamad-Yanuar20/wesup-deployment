import { MapPin, Layers } from "lucide-react";
import type { PaymentInvoice } from "@/lib/payments/types";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export default function PaymentInvoiceCard({
  invoice,
}: {
  invoice: PaymentInvoice;
}) {
  const savings =
    (invoice.basePricePerUnit - invoice.tierPricePerUnit) * invoice.quantity;

  return (
    <section
      aria-label="Tagihan pembayaran"
      className="border border-wesup-ink/15 bg-wesup-paper"
    >
      <header className="border-b border-wesup-ink/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">
            Tagihan Final
          </h2>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink">
            {invoice.batchDisplayCode}
          </span>
        </div>
      </header>

      <div className="divide-y divide-wesup-ink/10 px-4 sm:px-5">
        <div className="py-4">
          <p className="font-semibold text-wesup-ink">{invoice.batchTitle}</p>
          <p className="text-sm text-wesup-ink-sub">{invoice.supplierName}</p>
        </div>

        <dl className="py-4 text-sm">
          <div className="flex items-center justify-between py-1">
            <dt className="text-wesup-ink-sub">Kuantitas</dt>
            <dd className="font-semibold tabular-nums text-wesup-ink">
              {invoice.quantity} {invoice.unit}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="flex items-center gap-1.5 text-wesup-ink-sub">
              <Layers aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
              Harga / {invoice.unit} (Tier {invoice.lockedTier})
            </dt>
            <dd className="font-semibold tabular-nums text-wesup-ink">
              {money.format(invoice.tierPricePerUnit)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="text-wesup-ink-sub line-through">Harga dasar (Tier 1)</dt>
            <dd className="font-semibold tabular-nums text-wesup-ink-sub/60 line-through">
              {money.format(invoice.basePricePerUnit)}
            </dd>
          </div>
          {savings > 0 && (
            <div className="flex items-center justify-between py-1">
              <dt className="text-wesup-ink-sub">Diskon terkunci</dt>
              <dd className="font-semibold tabular-nums text-wesup-red">
                −{money.format(savings)}
              </dd>
            </div>
          )}

          <div className="mt-3 flex items-baseline justify-between border-t border-wesup-ink/15 pt-3">
            <dt className="font-semibold text-wesup-ink">Total Tagihan</dt>
            <dd className="font-landing-display text-2xl tabular-nums text-wesup-ink">
              {money.format(invoice.grossAmount)}
            </dd>
          </div>
        </dl>

        <div className="py-4 text-xs text-wesup-ink-sub">
          <p className="flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
            Titik kumpul: {invoice.pickupAddress}
          </p>
          <p className="mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
            Referensi: {invoice.midtransOrderId} · Estimasi siap:{" "}
            <span className="tabular-nums">{formatDate(invoice.estimatedReadyAt)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
