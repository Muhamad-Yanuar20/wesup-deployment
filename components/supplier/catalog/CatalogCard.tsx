"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Package, TrendingDown, Users } from "lucide-react";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";
import { isAllowedSupplierProductImageUrl } from "@/lib/supplier-catalog/image";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

function progressFor(registered: number, target: number): number {
  return target <= 0 ? 0 : Math.min(100, Math.max(0, (registered / target) * 100));
}

const STATUS_LABELS: Record<SupplierBatchStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Aktif",
  CLOSED: "Pendaftaran ditutup",
  CANCELLED_BY_SUPPLIER: "Dibatalkan",
  TAKEDOWN: "Diturunkan",
  COMPLETED: "Selesai",
};

function isAlert(status: SupplierBatchStatus): boolean {
  return status === "CANCELLED_BY_SUPPLIER" || status === "TAKEDOWN";
}

interface TierPrice {
  minimumQuantity: number;
  pricePerUnit: number;
}

interface PriceState {
  price: number;
  next: TierPrice | undefined;
  locked: boolean;
}

function priceState(batch: SupplierBatchDetail): PriceState {
  if (batch.lockedUnitPrice != null) {
    return { price: batch.lockedUnitPrice, next: undefined, locked: true };
  }
  const sorted = [...batch.tiers].sort((a, b) => a.minimumQuantity - b.minimumQuantity);
  if (sorted.length === 0) {
    return { price: batch.basePrice, next: undefined, locked: false };
  }
  
  let effective = sorted[0];
  for (const tier of sorted) {
    if (batch.registeredQuantity >= tier.minimumQuantity) effective = tier;
  }

  const nextTier = sorted.find(
    (tier) => 
      tier.minimumQuantity > batch.registeredQuantity && 
      tier.pricePerUnit < effective.pricePerUnit
  );

  return {
    price: effective.pricePerUnit,
    next: nextTier
      ? { minimumQuantity: nextTier.minimumQuantity, pricePerUnit: nextTier.pricePerUnit }
      : undefined,
    locked: false,
  };
}

export interface CatalogCardProps { batch: SupplierBatchDetail; }

export default function CatalogCard({ batch }: CatalogCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = batch.imageUrl.trim();
  const canRenderImage = isAllowedSupplierProductImageUrl(imageUrl) && failedImageUrl !== imageUrl;
  const inactive = batch.status !== "PUBLISHED";
  const progress = progressFor(batch.registeredQuantity, batch.targetQuantity);
  const date = new Date(batch.timeline.registrationOpensAt);
  const StatusIcon = isAlert(batch.status) ? AlertCircle : batch.status === "DRAFT" ? Clock3 : batch.status === "PUBLISHED" ? CheckCircle2 : Package;

  const { price, next, locked } = priceState(batch);
  const showStrikethrough = !locked && price < batch.basePrice;

  const showNextTier = !locked && batch.status === "PUBLISHED";
  const nextTier = showNextTier ? next : undefined;

  return (
    <Link href={`/supplier/batch/${batch.id}`} className="group block bg-wesup-paper transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-wesup-red">
      <div className="relative flex h-40 items-center justify-center bg-wesup-paper-sub">
        {canRenderImage ? (
          <Image
            src={imageUrl}
            alt={"Foto produk " + batch.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            onError={() => setFailedImageUrl(imageUrl)}
          />
        ) : (
          <Package aria-hidden="true" size={28} className="text-wesup-ink-sub" />
        )}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] ${isAlert(batch.status) ? "bg-wesup-red text-wesup-paper" : "bg-wesup-ink text-wesup-paper"}`}>
          <StatusIcon aria-hidden="true" size={12} /> {STATUS_LABELS[batch.status]}
        </span>
        <span className="absolute right-3 top-3 border border-wesup-ink/20 bg-wesup-paper px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
          {batch.category}
        </span>
      </div>

      <div className="border-t border-wesup-ink/10 p-4 sm:p-5">
        <p className="mb-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
          <span className="tabular-nums">{batch.displayCode}</span>
        </p>
        <h3 className="truncate text-base font-semibold text-wesup-ink underline decoration-transparent underline-offset-[6px] transition-colors duration-300 group-hover:decoration-wesup-red">
          {batch.title}
        </h3>
        <div className="mt-3">
          <span className="font-landing-display text-xl font-medium tabular-nums tracking-tight text-wesup-ink">
            <span aria-hidden="true" className="mb-3 block h-px w-6 bg-wesup-red" />
            {money.format(price)}
          </span>
          
          {showStrikethrough && (
            <span className="ml-2 text-xs text-wesup-ink-sub line-through">
              {money.format(batch.basePrice)}
            </span>
          )}

          {/* UI BARU UNTUK NEXT TIER */}
          {nextTier && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[0.7rem] text-wesup-ink-sub">
              <TrendingDown size={13} className="text-wesup-red" />
              <span>
                Jadi <strong className="font-semibold text-wesup-ink">{money.format(nextTier.pricePerUnit)}</strong> mulai <span className="tabular-nums font-semibold">{nextTier.minimumQuantity}</span> {batch.unit}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
            <span className="flex items-center gap-1">
              <Users aria-hidden="true" size={12} /> <span className="tabular-nums">{batch.participantCount}</span> peserta
            </span>
            <span>
              <span className="tabular-nums">{batch.registeredQuantity}</span>/<span className="tabular-nums">{batch.targetQuantity}</span> pcs
            </span>
          </div>
          <div className="relative h-px w-full bg-wesup-ink/20">
            <div
              className={`absolute left-0 top-0 h-[3px] -translate-y-px ${inactive ? "bg-wesup-ink/30" : "bg-wesup-red"} transition-[width] duration-300 wesup-ease`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-wesup-ink/10 pt-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
          <span className="truncate">{batch.pickup.name}</span>
          <span className="shrink-0 tabular-nums">{Number.isNaN(date.getTime()) ? "-" : dates.format(date)}</span>
        </div>
      </div>
    </Link>
  );
}
