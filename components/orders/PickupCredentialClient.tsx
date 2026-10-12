"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCheck,
  Clock,
  Copy,
  CreditCard,
  KeyRound,
  MapPin,
  PackageCheck,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
  XCircle,
} from "lucide-react";
import type {
  AccountOrderStatus,
  PickupCredential,
} from "@/lib/orders/types";
import { getComplaintScenario } from "@/lib/dispute/mock-data";
import PickupQrBlock from "./PickupQrBlock";
import EscrowCountdown from "@/components/disputes/EscrowCountdown";
import PaymentPageLink from "@/components/payments/PaymentPageLink";

const ESCROW_WINDOW_MS = 24 * 60 * 60 * 1000;

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const panel = "border border-wesup-ink/15 bg-wesup-paper";
const panelHeading = "flex items-center gap-2 font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink";
const primaryBtn = "inline-flex min-h-12 items-center gap-2 border border-wesup-ink bg-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5";
const alertBtn = "inline-flex min-h-11 items-center gap-1.5 border border-wesup-red bg-wesup-paper px-4 py-2 text-sm font-semibold text-wesup-red transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dates.format(date);
}

const WAIT_BANNER: Record<
  AccountOrderStatus,
  { label: string; description: string } | null
> = {
  registered: {
    label: "Menunggu Jendela Pembayaran Dibuka",
    description:
      "Registrasi Anda tercatat. Kode QR dan PIN pengambilan baru diterbitkan setelah tagihan dibayar lunas saat jendela pembayaran aktif.",
  },
  pending_payment: {
    label: "Kredensial Belum Terbit",
    description:
      "Tagihan belum dibayar. Selesaikan pembayaran QRIS untuk menerbitkan kode QR pengambilan dan PIN 4 digit.",
  },
  paid: null,
  picked_up: {
    label: "Serah Terima Selesai",
    description:
      "Barang sudah Anda ambil dan tervalidasi Supplier. Hitung mundur escrow 1×24 jam telah berjalan sejak pengambilan.",
  },
  completed: {
    label: "Pesanan Selesai",
    description: "Masa escrow selesai tanpa komplain yang dibuka.",
  },
  no_show: {
    label: "Tidak Hadir — Dana Hangus",
    description:
      "Anda tidak mengambil barang hingga batas toleransi 12 jam sejak estimasi siap. Sesuai ketentuan PRD 2.2.4, dana tidak dapat dikembalikan (non-refundable).",
  },
  cancelled: {
    label: "Pesanan Dibatalkan",
    description:
      "Pesanan ini dibatalkan. Jika sudah pernah membayar, refund akan diproses oleh Admin.",
  },
  refund_pending: {
    label: "Refund Diproses",
    description: "Dana sedang menunggu proses refund manual oleh Admin.",
  },
  refunded: {
    label: "Refund Selesai",
    description: "Dana telah ditandai dikembalikan oleh Admin.",
  },
};

export default function PickupCredentialClient({
  credential,
}: {
  credential: PickupCredential;
}) {
  const banner = WAIT_BANNER[credential.status];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
        <Link
          href="/pesanan"
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
          Pesanan
        </Link>
        <span aria-hidden="true" className="text-wesup-ink-sub/40">/</span>
        <span className="truncate text-wesup-ink-sub">Serah Terima</span>
      </nav>

      <header className="border-b border-wesup-ink/10 pb-6">
        <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-wesup-ink-sub">
          <span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />
          Serah Terima Pengambilan
        </p>
        <h1 className="mt-4 font-landing-display text-3xl uppercase leading-[0.95] tracking-[0.06em] text-wesup-ink">
          {credential.batchTitle}
        </h1>
        <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
          {credential.supplierName} · {credential.batchDisplayCode}
        </p>
      </header>

      {banner ? (
        <section
          aria-label={`Status pesanan: ${banner.label}`}
          className="relative border border-wesup-ink/15 bg-wesup-paper p-5 pl-6"
        >
          <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-0.5 ${credential.status === "no_show" ? "bg-wesup-red" : "bg-wesup-ink/30"}`} />
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center border border-wesup-ink/20 text-wesup-ink-sub"
            >
              <StatusIcon status={credential.status} />
            </span>
            <div>
              <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">{banner.label}</h2>
              <p className="mt-1 text-sm leading-relaxed text-wesup-ink-sub">
                {banner.description}
              </p>
              {credential.status === "pending_payment" && (
                <PaymentPageLink href={`/pesanan/${credential.orderId}/bayar`} className={`mt-3 ${primaryBtn}`}>
                  <CreditCard aria-hidden="true" size={16} strokeWidth={1.5} />
                  Bayar Sekarang
                </PaymentPageLink>
              )}
              {credential.status === "picked_up" && (
                <PickupCompletedSection credential={credential} />
              )}
            </div>
          </div>
        </section>
      ) : (
        <PaidCredential credential={credential} />
      )}

      <OrderSummaryCard credential={credential} />

      <PickupRulesNote />
    </div>
  );
}

function StatusIcon({ status }: { status: AccountOrderStatus }) {
  const className = "size-5";
  switch (status) {
    case "registered":
      return <Clock aria-hidden="true" className={`${className} text-wesup-ink-sub`} strokeWidth={1.5} />;
    case "pending_payment":
      return <CreditCard aria-hidden="true" className={`${className} text-wesup-ink-sub`} strokeWidth={1.5} />;
    case "picked_up":
      return <PackageCheck aria-hidden="true" className={`${className} text-wesup-ink`} strokeWidth={1.5} />;
    case "no_show":
      return <XCircle aria-hidden="true" className={`${className} text-wesup-red`} strokeWidth={1.5} />;
    case "cancelled":
      return <Ban aria-hidden="true" className={`${className} text-wesup-red`} strokeWidth={1.5} />;
    default:
      return null;
  }
}

function PickupCompletedSection({ credential }: { credential: PickupCredential }) {
  const deadlineAt = credential.pickedUpAt
    ? new Date(new Date(credential.pickedUpAt).getTime() + ESCROW_WINDOW_MS).toISOString()
    : null;
  const scenario = getComplaintScenario(credential.orderId);

  return (
    <div className="mt-4 space-y-3 border-t border-wesup-ink/10 pt-4">
      {deadlineAt && <EscrowCountdown deadlineAt={deadlineAt} />}
      <p className="text-xs leading-relaxed text-wesup-ink-sub">
        Hitung mundur escrow 1×24 jam berjalan sejak pengambilan. Ajukan komplain sebelum batas
        waktu ini untuk membekukan pencairan dana ke Supplier.
      </p>
      {scenario?.kind === "filed" ? (
        <Link href={`/pesanan/${credential.orderId}/sengketa`} className={alertBtn}>
          <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.5} />
          Lacak Sengketa
        </Link>
      ) : scenario?.kind === "window_open" ? (
        <Link href={`/pesanan/${credential.orderId}/komplain`} className={alertBtn}>
          <ShieldAlert aria-hidden="true" size={16} strokeWidth={1.5} />
          Ajukan Komplain
        </Link>
      ) : null}
    </div>
  );
}

function PaidCredential({ credential }: { credential: PickupCredential }) {
  if (credential.status !== "paid") return null;
  const seed = `${credential.pickupCode ?? credential.orderId}::${credential.orderId}`;

  return (
    <section
      aria-label="Kode QR dan PIN pengambilan"
      className="grid grid-cols-1 gap-px border border-wesup-ink/10 bg-wesup-ink/10 lg:grid-cols-2"
    >
      <div className="bg-wesup-paper p-5">
        <h2 className={panelHeading}>
          <QrCode aria-hidden="true" size={18} className="text-wesup-red" strokeWidth={1.5} />
          Kode QR Pengambilan
        </h2>
        <p className="mb-4 mt-1 text-xs text-wesup-ink-sub">
          Perlihatkan kode ini ke Supplier saat tiba di titik kumpul.
        </p>
        {credential.pickupCode ? (
          <PickupQrBlock seed={seed} />
        ) : (
          <p className="text-sm text-wesup-ink-sub">Kode QR belum tersedia.</p>
        )}
      </div>

      <div className="bg-wesup-paper p-5">
        <h2 className={panelHeading}>
          <KeyRound aria-hidden="true" size={18} className="text-wesup-ink-sub" strokeWidth={1.5} />
          PIN 4-digit Cadangan
        </h2>
        <p className="mb-4 mt-1 text-xs text-wesup-ink-sub">
          Gunakan PIN ini jika kamera Supplier bermasalah (fallback operasional).
        </p>
        {credential.pinCode ? (
          <PinDisplay pin={credential.pinCode} orderId={credential.orderId} />
        ) : (
          <p className="text-sm text-wesup-ink-sub">PIN belum tersedia.</p>
        )}
      </div>

      <div className="bg-wesup-paper p-5 lg:col-span-2">
        <h2 className={panelHeading}>
          <CalendarClock aria-hidden="true" size={18} className="text-wesup-ink-sub" strokeWidth={1.5} />
          Lokasi &amp; Jendela Pengambilan
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-wesup-ink-sub" strokeWidth={1.5} />
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Titik kumpul</dt>
              <dd className="mt-0.5 text-wesup-ink">{credential.pickupAddress}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-wesup-ink-sub" strokeWidth={1.5} />
            <div>
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Estimasi siap (awal jendela)</dt>
              <dd className="mt-0.5 tabular-nums text-wesup-ink">{formatDate(credential.estimatedReadyAt)}</dd>
            </div>
          </div>
        </dl>
        <p className="mt-3 border-l-2 border-wesup-red bg-wesup-paper-sub px-3 py-2 text-xs leading-5 text-wesup-ink-sub">
          Waktu pengambilan tersedia hingga{" "}
          <strong className="tabular-nums text-wesup-ink">{formatDate(credential.pickupDeadlineAt)}</strong>{" "}
          — jendela toleransi 12 jam sejak estimasi siap. Melewati batas tersebut
          mengaktifkan skenario No-Show (dana hangus 100%, non-refundable).
        </p>
      </div>
    </section>
  );
}

function PinDisplay({ pin, orderId }: { pin: string; orderId: string }) {
  const [copied, setCopied] = useState(false);

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  };

  return (
    <div>
      <div aria-hidden="true" className="grid grid-cols-4 gap-2 border-y border-wesup-ink/15 py-4">
        {pin.split("").map((digit, index) => (
          <div
            key={`${orderId}-pin-${index}`}
            className="border border-wesup-ink/20 bg-wesup-paper-sub py-4 text-center font-mono text-3xl font-black tabular-nums text-wesup-ink"
          >
            {digit}
          </div>
        ))}
      </div>
      <p className="sr-only">PIN 4 digit: {pin.split("").join(" ")}</p>
      <button
        type="button"
        onClick={copyPin}
        aria-label={copied ? "PIN tersalin ke clipboard" : "Salin PIN"}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 border border-wesup-ink/20 bg-wesup-paper px-4 py-2 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub"
      >
        {copied ? (
          <>
            <CheckCheck aria-hidden="true" className="size-4 text-wesup-red" strokeWidth={1.5} />
            PIN tersalin
          </>
        ) : (
          <>
            <Copy aria-hidden="true" className="size-4" strokeWidth={1.5} />
            Salin PIN
          </>
        )}
      </button>
    </div>
  );
}

function OrderSummaryCard({ credential }: { credential: PickupCredential }) {
  return (
    <section aria-label="Ringkasan pesanan" className={panel}>
      <header className="flex items-center gap-2 border-b border-wesup-ink/10 px-4 py-3 sm:px-5">
        <ShoppingBag aria-hidden="true" className="size-4 text-wesup-ink-sub" strokeWidth={1.5} />
        <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Ringkasan Pesanan</h2>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-4 sm:p-5">
        <div>
          <dt className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
            <Store aria-hidden="true" className="size-3.5" strokeWidth={1.5} />Supplier
          </dt>
          <dd className="mt-0.5 font-semibold text-wesup-ink">{credential.supplierName}</dd>
        </div>
        <div>
          <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Kuantitas</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-wesup-ink">{credential.quantity} {credential.unit}</dd>
        </div>
        <div>
          <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Tier terkunci</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-wesup-ink">Tier {credential.lockedTier ?? 1}</dd>
        </div>
        <div>
          <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Total tagihan</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-wesup-ink">{money.format(credential.finalAmount)}</dd>
        </div>
      </dl>
    </section>
  );
}

function PickupRulesNote() {
  return (
    <section aria-label="Aturan serah terima" className="border border-wesup-ink/15 bg-wesup-paper-sub p-4 text-sm text-wesup-ink-sub">
      <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink">Aturan serah terima (PRD 2.2.4)</p>
      <ul className="mt-2 space-y-1.5">
        <li className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-wesup-red" />Kode QR &amp; PIN hanya diterbitkan setelah tagihan <strong className="text-wesup-ink">lunas</strong>.</li>
        <li className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-wesup-red" />Berhasil dipindai menandai pesanan <strong className="text-wesup-ink">Sudah Diambil</strong> dan memulai hitung mundur escrow 1×24 jam.</li>
        <li className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-wesup-red" />Tidak hadir hingga batas toleransi 12 jam sejak estimasi siap memicu skenario No-Show: dana hangus 100% dan tidak dapat di-refund.</li>
      </ul>
    </section>
  );
}
