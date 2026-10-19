"use client";

import type { MarketplaceTier, TierProgress } from "@/lib/marketplace/types";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export interface TierProgressBarProps {
  registeredQuantity: number;
  tiers: readonly MarketplaceTier[];
  tierProgress: TierProgress;
  targetQuantity?: number;
  showPrice?: boolean;
  className?: string;
}

export default function TierProgressBar({
  registeredQuantity,
  tiers,
  tierProgress,
  targetQuantity,
  showPrice = true,
  className = "",
}: TierProgressBarProps) {
  const currentTier = tiers.find(
    (tier) => tier.tierNumber === tierProgress.currentTierNumber,
  );
  const progressPercent = Math.max(0, Math.min(100, tierProgress.progressPercent));
  const targetCopy =
    typeof targetQuantity === "number" && targetQuantity > 0
      ? `Target Kelompok: ${registeredQuantity}/${targetQuantity} Porsi`
      : `${registeredQuantity} unit terkumpul`;

  return (
    <section
      className={`flex flex-col gap-3 p-4 bg-wesup-paper  border border-wesup-ink/15  ${className}`}
      aria-label="Progress volume dan harga tier"
    >
      <div className="flex items-center justify-between gap-3 text-sm tabular-nums">
        <div className="flex flex-col gap-1 tabular-nums">
          <span className="font-semibold text-wesup-ink-sub">{targetCopy}</span>
          <span className="text-xs font-medium text-wesup-ink-sub">
            {registeredQuantity} unit terkumpul • Tier {tierProgress.currentTierNumber}
          </span>
        </div>
        <span className="font-bold text-wesup-ink-sub">{progressPercent}%</span>
      </div>

      <div
        className="w-full h-px bg-wesup-ink/20"
        role="progressbar"
        aria-label="Progres target kelompok"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <div
          className="h-[3px] w-full origin-left -translate-y-px bg-wesup-red transition-transform duration-500 wesup-ease motion-reduce:transition-none"
          style={{ transform: `translateY(-1px) scaleX(${progressPercent / 100})` }}
        />
      </div>

      {showPrice ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 tabular-nums">
          <span className="text-sm font-bold text-wesup-ink">
            {rupiahFormatter.format(tierProgress.currentPricePerUnit)} / unit
          </span>
          {currentTier && currentTier.pricePerUnit !== tierProgress.currentPricePerUnit ? (
            <span className="text-xs text-wesup-ink-sub">
              Tier {currentTier.tierNumber}: {rupiahFormatter.format(currentTier.pricePerUnit)}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs font-medium text-wesup-ink-sub" aria-live="polite">
        {tierProgress.nextTierNumber === null
          ? "Tier terbaik tercapai"
          : `${tierProgress.remainingToNextTier} unit lagi menuju Tier ${tierProgress.nextTierNumber}`}
      </p>
    </section>
  );
}
