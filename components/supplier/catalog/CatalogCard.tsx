"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, MapPin, Package, Users } from "lucide-react";
import type { SupplierBatchDetail } from "@/lib/supplier-batch/types";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function progressFor(registered: number, target: number): number {
  return target <= 0
    ? 0
    : Math.min(100, Math.max(0, (registered / target) * 100));
}

export interface CatalogCardProps {
  batch: SupplierBatchDetail;
}

export default function CatalogCard({ batch }: CatalogCardProps) {
  const cancelled = batch.status === "CANCELLED_BY_SUPPLIER";
  const progress = progressFor(batch.registeredQuantity, batch.targetQuantity);
  const lowest = batch.tiers.at(-1)?.pricePerUnit ?? batch.basePrice;

  return (
    <Link
      href={`/supplier/batch/${batch.id}`}
      className="group block rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      {/* Image placeholder */}
      <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-t-xl bg-slate-100">
        <Package
          aria-hidden="true"
          size={32}
          className="text-slate-300"
        />
        {/* Status badge overlay */}
        <span
          className={
            cancelled
              ? "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
              : "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/80 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
          }
        >
          {cancelled ? (
            <AlertCircle aria-hidden="true" size={12} />
          ) : (
            <CheckCircle2 aria-hidden="true" size={12} />
          )}
          {cancelled ? "Dibatalkan" : "Aktif"}
        </span>
        {/* Category badge */}
        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-700 backdrop-blur-sm">
          {batch.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-700">
          {batch.title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">{batch.displayCode}</p>

        {/* Price */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-blue-700">
            {money.format(lowest)}
          </span>
          {lowest < batch.basePrice && (
            <span className="text-xs text-slate-400 line-through">
              {money.format(batch.basePrice)}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users aria-hidden="true" size={12} />
              {batch.participantCount} peserta
            </span>
            <span>
              {batch.registeredQuantity}/{batch.targetQuantity} pcs
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={
                cancelled
                  ? "h-full rounded-full bg-slate-300"
                  : "h-full rounded-full bg-blue-500"
              }
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Location + Date */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1 truncate">
            <MapPin aria-hidden="true" size={12} className="shrink-0" />
            <span className="truncate">{batch.pickup.name}</span>
          </span>
          <span className="shrink-0">
            {dates.format(new Date(batch.timeline.registrationOpensAt))}
          </span>
        </div>
      </div>
    </Link>
  );
}
