"use client";

import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";

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

interface CatalogReviewStepProps {
  draft: CatalogDraft;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export default function CatalogReviewStep({
  draft,
  headingRef,
}: CatalogReviewStepProps) {
  const lowestPrice = draft.tiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = draft.tiers.at(0)?.pricePerUnit ?? 0;

  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-wesup-ink outline-none"
      >
        Tinjauan Penawaran
      </h2>
      <p className="text-sm text-wesup-ink-sub">
        Pastikan semua informasi sudah benar sebelum menerbitkan penawaran.
      </p>

      {/* Status */}
      <div className=" border border-wesup-ink/20 bg-wesup-paper-sub p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-wesup-red" />
          <p className="text-sm font-medium text-wesup-ink">
            Penawaran ini akan langsung tayang di marketplace setelah diterbitkan.
          </p>
        </div>
      </div>

      {/* Product Info */}
      <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
          <Package size={16} className="text-wesup-red" />
          Detail Produk
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-wesup-ink-sub">Nama Produk</dt>
            <dd className="font-semibold text-wesup-ink">{draft.title}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-wesup-ink-sub">Kategori</dt>
            <dd>
              <span className=" bg-wesup-paper-sub px-2 py-0.5 text-xs font-medium text-wesup-red">
                {draft.category}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-wesup-ink-sub">Deskripsi</dt>
            <dd className="max-w-xs text-right text-wesup-ink">
              {draft.description}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-wesup-ink-sub">Foto Produk</dt>
            <dd className="flex items-center gap-1 font-medium text-wesup-ink-sub">
              <CheckCircle2 size={14} />
              {draft.productPhoto?.name ?? "Terkirim"}
            </dd>
          </div>
          <div className="flex justify-between"><dt className="text-wesup-ink-sub">Kapasitas</dt><dd className="font-semibold text-wesup-ink">{draft.capacityQuantity ?? draft.targetQuantity} {draft.unit ?? "pcs"}</dd></div>
        </dl>
      </section>

      {/* Tier Pricing */}
      <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
          <TrendingDown size={16} className="text-wesup-red" />
          Skema Harga Tier
        </h3>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-xl font-bold text-wesup-ink">
            {money.format(lowestPrice)}
          </span>
          {lowestPrice < highestPrice && (
            <span className="text-sm text-wesup-ink-sub line-through">
              {money.format(highestPrice)}
            </span>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {draft.tiers.map((tier) => (
            <li key={tier.tierNumber} className="flex justify-between">
              <span className="text-wesup-ink-sub">
                Tier {tier.tierNumber}: {tier.minimumQuantity}–{tier.maximumQuantity ?? "+"} pcs
              </span>
              <strong className="text-wesup-ink">{money.format(tier.pricePerUnit)}</strong>
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
          <Clock size={16} className="text-wesup-ink-sub" />
          Timeline
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center gap-3"><CreditCard size={14} className="text-wesup-ink-sub" /><dt className="w-36 text-wesup-ink-sub">Jendela bayar</dt><dd className="font-semibold text-wesup-ink">{draft.paymentWindowHours ?? 24} jam setelah batch ditutup</dd></div>
          {(
            [
              ["Buka Pendaftaran", draft.registrationOpensAt, Calendar, "text-wesup-ink-sub"],
              ["Tutup Pendaftaran", draft.registrationClosesAt, Clock, "text-wesup-ink-sub"],
              ["Mulai Payment", draft.paymentOpensAt, CreditCard, "text-wesup-ink-sub"],
              ["Batas Payment", draft.paymentClosesAt, CreditCard, "text-wesup-ink-sub"],
              ["Estimasi Ready", draft.estimatedReadyAt, Truck, "text-wesup-ink-sub"],
            ] as const
          ).map(([label, value, Icon, color]) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={14} className={color} />
              <dt className="w-36 text-wesup-ink-sub">{label}</dt>
              <dd className="font-semibold text-wesup-ink">
                {value ? dates.format(new Date(value)) : "Belum diatur"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pickup Location */}
      <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
          <MapPin size={16} className="text-wesup-ink-sub" />
          Lokasi Pengambilan
        </h3>
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-wesup-ink">{draft.pickupName}</p>
          <p className="text-wesup-ink-sub">{draft.pickupAddress}</p>
          {draft.pickupLatitude !== null && draft.pickupLongitude !== null && (
            <p className="font-mono text-xs text-wesup-ink-sub">
              Koordinat: {draft.pickupLatitude.toFixed(5)}, {draft.pickupLongitude.toFixed(5)}
            </p>
          )}
        </div>
      </section>

      {/* Recurring */}
      {draft.recurring.enabled && (
        <section className=" border border-wesup-ink/20 bg-wesup-paper-sub p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink-sub">
            <CalendarClock size={16} className="text-wesup-ink-sub" />
            Postingan Berulang
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-wesup-ink-sub">Nama Jadwal</dt>
              <dd className="font-semibold text-wesup-ink-sub">{draft.recurring.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-wesup-ink-sub">Interval</dt>
              <dd className="font-semibold text-wesup-ink-sub">
                Setiap {draft.recurring.intervalDays} hari
                {draft.recurring.daysOfWeek.length > 0 && (
                  <>
                    {" "}
                    &middot;{" "}
                    {draft.recurring.daysOfWeek
                      .sort((a, b) => a - b)
                      .map((d) => ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d])
                      .join(", ")}
                  </>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3  bg-wesup-paper/60 p-3 text-xs text-wesup-ink-sub">
            Setelah penawaran ini tayang, batch berikutnya akan di-generate otomatis
            sesuai jadwal. Anda akan menerima notifikasi H-1 untuk review.
          </p>
        </section>
      )}
    </div>
  );
}
