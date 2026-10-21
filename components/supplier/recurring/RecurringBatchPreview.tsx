"use client";

import {
  AlertCircle,
  Calendar,
  CreditCard,
  MapPin,
  Package,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { RecurringBatchPreview } from "@/lib/supplier-recurring/types";

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

interface RecurringBatchPreviewProps {
  preview: RecurringBatchPreview;
}

export default function RecurringBatchPreviewCard({
  preview,
}: RecurringBatchPreviewProps) {
  const lowestPrice = preview.tiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = preview.tiers.at(0)?.pricePerUnit ?? 0;

  return (
    <div className=" border border-wesup-ink/20 bg-wesup-paper-sub/50 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
        <Package size={16} className="text-wesup-red" />
        Preview Batch yang Akan Di-generate
      </h3>

      {/* Product Info */}
      <section className="mb-3  border border-wesup-paper bg-wesup-paper p-4 ">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-wesup-ink">
          <Package size={14} className="text-wesup-red" />
          Detail Produk
        </h4>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-wesup-ink-sub">Nama Produk</dt>
            <dd className="font-semibold text-wesup-ink">{preview.templateTitle}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-wesup-ink-sub">Kategori</dt>
            <dd>
              <span className=" bg-wesup-paper-sub px-2 py-0.5 text-xs font-medium text-wesup-red">
                {preview.category}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Tier Pricing */}
      <section className="mb-3  border border-wesup-paper bg-wesup-paper p-4 ">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-wesup-ink">
          <TrendingDown size={14} className="text-wesup-red" />
          Skema Harga Tier
        </h4>
        <div className="mb-2 flex items-baseline gap-3">
          <span className="text-lg font-bold text-wesup-ink">
            {money.format(lowestPrice)}
          </span>
          {lowestPrice < highestPrice && (
            <span className="text-xs text-wesup-ink-sub line-through">
              {money.format(highestPrice)}
            </span>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {preview.tiers.map((tier) => (
            <li key={tier.tierNumber} className="flex justify-between">
              <span className="text-wesup-ink-sub">
                Tier {tier.tierNumber}: {tier.minimumQuantity}–
                {tier.maximumQuantity ?? "+"} pcs
              </span>
              <strong className="text-wesup-ink">
                {money.format(tier.pricePerUnit)}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="mb-3  border border-wesup-paper bg-wesup-paper p-4 ">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-wesup-ink">
          <Calendar size={14} className="text-wesup-ink-sub" />
          Timeline (Estimasi)
        </h4>
        <dl className="space-y-1.5 text-sm">
          {(
            [
              ["Buka Pendaftaran", preview.estimatedRegistrationOpensAt, Calendar, "text-wesup-ink-sub"],
              ["Tutup Pendaftaran", preview.estimatedRegistrationClosesAt, Calendar, "text-wesup-ink-sub"],
              ["Mulai Payment", preview.estimatedPaymentOpensAt, CreditCard, "text-wesup-ink-sub"],
              ["Batas Payment", preview.estimatedPaymentClosesAt, CreditCard, "text-wesup-ink-sub"],
              ["Estimasi Ready", preview.estimatedReadyAt, Truck, "text-wesup-ink-sub"],
            ] as const
          ).map(([label, value, Icon, color]) => (
            <div key={label} className="flex items-center gap-2">
              <Icon size={12} className={color} />
              <dt className="w-32 text-xs text-wesup-ink-sub">{label}</dt>
              <dd className="text-xs font-semibold text-wesup-ink">
                {dates.format(new Date(value))}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pickup Location */}
      <section className=" border border-wesup-paper bg-wesup-paper p-4 ">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-wesup-ink">
          <MapPin size={14} className="text-wesup-ink-sub" />
          Lokasi Pengambilan
        </h4>
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-wesup-ink">{preview.pickupName}</p>
          <p className="text-wesup-ink-sub">{preview.pickupAddress}</p>
        </div>
      </section>

      <div className="mt-3 flex items-start gap-2  bg-wesup-paper-sub/50 p-3 text-xs text-wesup-ink-sub">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <p>
          Batch ini akan diterbitkan otomatis sesuai jadwal. Anda akan menerima
          notifikasi H-1 untuk melakukan review sebelum tayang.
        </p>
      </div>
    </div>
  );
}
