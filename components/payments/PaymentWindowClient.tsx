"use client";

import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2, CalendarClock, QrCode } from "lucide-react";
import type { PaymentInvoice } from "@/lib/payments/types";
import { evaluatePaymentWindow } from "@/lib/orders/time-gatekeeper";
import PaymentCountdown from "./PaymentCountdown";
import PaymentInvoiceCard from "./PaymentInvoiceCard";
import QrisPaymentMock from "./QrisPaymentMock";
import HitAndRunBanner from "./HitAndRunBanner";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export default function PaymentWindowClient({
  invoice,
}: {
  invoice: PaymentInvoice;
}) {
  // State Gate dihitung dari serverTime mock — bukan jam perangkat.
  const gate = evaluatePaymentWindow(
    {
      registration_opens_at: invoice.paymentOpensAt,
      registration_closes_at: invoice.paymentOpensAt,
      payment_opens_at: invoice.paymentOpensAt,
      payment_closes_at: invoice.paymentClosesAt,
      estimated_ready_at: invoice.estimatedReadyAt,
    },
    invoice.serverTime,
  );

  const isPaid = invoice.resolution === "paid";
  const isExpired = !isPaid && gate.state === "expired";
  const isOpen = !isPaid && gate.state === "open";
  const isWaiting = !isPaid && gate.state === "waiting";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
        <Link
          href="/pesanan"
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
          Pesanan
        </Link>
        <span aria-hidden="true" className="text-wesup-ink-sub/40">/</span>
        <span className="truncate text-wesup-ink-sub">
          Bayar {invoice.batchTitle}
        </span>
      </nav>

      <header className="border-b border-wesup-ink/10 pb-6">
        <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-wesup-ink-sub">
          <span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />
          Pembayaran Tagihan
        </p>
        <h1 className="mt-4 font-landing-display text-3xl uppercase leading-[0.95] tracking-[0.06em] text-wesup-ink sm:text-4xl">
          {invoice.batchTitle}
        </h1>
        <p className="mt-3 text-sm leading-6 text-wesup-ink-sub">
          Tagihan final terkunci pada tier diskon{" "}
          <strong className="font-semibold text-wesup-ink">
            Tier {invoice.lockedTier}
          </strong>{" "}
          saat pendaftaran ditutup.
        </p>
      </header>

      {isExpired && invoice.strikes ? (
        <HitAndRunBanner strikes={invoice.strikes} />
      ) : null}

      {isPaid ? (
        <section
          aria-label="Pembayaran lunas"
          className="relative border border-wesup-ink/20 bg-wesup-paper-sub p-4 pl-6"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-wesup-ink" />
          <div className="flex items-start gap-3">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-wesup-ink"
              strokeWidth={1.5}
            />
            <div>
              <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">
                Pembayaran terkonfirmasi lunas
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-wesup-ink-sub">
                Webhook Midtrans telah diterima. Kode QR pengambilan dan PIN
                4 digit sudah diterbitkan di halaman serah terima.
              </p>
              <Link
                href={`/pesanan/${invoice.orderId}/serah-terima`}
                className="mt-3 inline-flex min-h-12 items-center gap-2 border border-wesup-ink bg-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5"
              >
                <QrCode aria-hidden="true" className="size-4" strokeWidth={1.5} />
                Lihat Kode QR Pengambilan
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-label="Status jendela pembayaran"
          className="border border-wesup-ink/15 bg-wesup-paper p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">
              <Clock aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {isWaiting && "Menunggu jendela pembayaran dibuka"}
              {isOpen && "Sisa waktu pembayaran"}
              {isExpired && "Jendela pembayaran ditutup"}
            </div>
            {isWaiting && (
              <PaymentCountdown
                serverNowIso={invoice.serverTime}
                deadlineIso={invoice.paymentOpensAt}
                tone="info"
              />
            )}
            {isOpen && (
              <PaymentCountdown
                serverNowIso={invoice.serverTime}
                deadlineIso={invoice.paymentClosesAt}
                tone="danger"
              />
            )}
            {isExpired && (
              <span className="bg-wesup-red px-3 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper">
                Expired
              </span>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
              <dt>Buka:</dt>
              <dd className="tabular-nums text-wesup-ink">{formatDate(invoice.paymentOpensAt)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
              <dt>Batas akhir:</dt>
              <dd className="tabular-nums text-wesup-ink">{formatDate(invoice.paymentClosesAt)}</dd>
            </div>
          </dl>
        </section>
      )}

      <PaymentInvoiceCard invoice={invoice} />
      <QrisPaymentMock
        resolution={invoice.resolution}
        grossAmount={invoice.grossAmount}
      />

      <p className="text-center text-[0.6875rem] leading-relaxed text-wesup-ink-sub">
        Hitung mundur dikalkulasi dari <strong className="text-wesup-ink">Server Timestamp</strong> respons
        API Gatekeeper, bukan jam lokal perangkat — mencegah manipulasi batas
        waktu. Melewatkan window memicu sanksi Hit &amp; Run berjenjang.
      </p>
    </div>
  );
}
