"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogIn, MapPin, Clock, Tag, Share2 } from "lucide-react";
import type { UserRole } from "@/types/database";
import type {
  MarketplaceItem,
  MarketplaceProgressResponse,
  MarketplaceTier,
} from "@/lib/marketplace/types";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";
import { buildWhatsAppShareUrl } from "@/lib/marketplace/share-link";
import MarketplaceRouteSection, { type MarketplaceRouteSummary } from "./MarketplaceRouteSection";
import LocationConsentCheckbox from "./LocationConsentCheckbox";
import SupplierRatingBadge from "./SupplierRatingBadge";
import TierProgressBar from "./TierProgressBar";
import JoinIntentQuantity from "./JoinIntentQuantity";
import JoinBatchForm from "./JoinBatchForm";
import { useTierProgress } from "@/hooks/use-tier-progress";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const closingTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatClosingTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tutup belum tersedia"
    : closingTimeFormatter.format(date);
}

function resolveInitialTiers(item: MarketplaceItem): MarketplaceTier[] {
  if (item.tiers && item.tiers.length > 0) return [...item.tiers];
  const target = Math.max(2, Math.trunc(item.targetQuantity));
  return [
    {
      tierNumber: 1,
      minVolume: 1,
      maxVolume: target - 1,
      pricePerUnit: item.currentTierPrice,
    },
    {
      tierNumber: 2,
      minVolume: target,
      maxVolume: null,
      pricePerUnit: item.currentTierPrice,
    },
  ];
}

function buildInitialProgress(item: MarketplaceItem): MarketplaceProgressResponse {
  const tiers = resolveInitialTiers(item);
  return {
    batchId: item.id,
    status: item.status === "ACTIVE" ? "published" : item.status.toLowerCase(),
    registeredQuantity: item.registeredQuantity,
    tiers,
    tierProgress: deriveTierProgress(tiers, item.registeredQuantity),
    registrationClosesAt: item.registrationClosesAt,
    serverTime: new Date().toISOString(),
  };
}

export interface MarketplaceDetailClientProps {
  item: MarketplaceItem;
  canonicalUrl: string;
  /** Current viewers role from the server session; `null` when not signed in. */
  viewerRole: UserRole | null;
  /** Whether an authenticated UMKM has completed the required business profile. */
  viewerProfileComplete?: boolean;
  /** Whether this UMKM is using the temporary Bandung fallback. */
  needsProfileLocation?: boolean;
}

export default function MarketplaceDetailClient({
  item,
  canonicalUrl,
  viewerRole,
  viewerProfileComplete = true,
  needsProfileLocation = false,
}: MarketplaceDetailClientProps) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [routeSummary, setRouteSummary] = useState<MarketplaceRouteSummary | null>(null);
  const initialProgress = useMemo(() => buildInitialProgress(item), [item]);
  const {
    progress: liveProgress,
    error: progressError,
    isRefreshing,
    applyRegistration,
  } = useTierProgress(item.id, initialProgress);

  const isUmkm = viewerRole === "umkm";
  const canJoinBatch = isUmkm && viewerProfileComplete;
  const viewerCanRoute = isUmkm && !needsProfileLocation;
  const handleRouteLoaded = useCallback((summary: MarketplaceRouteSummary) => {
    setRouteSummary(summary);
  }, []);
  const shareUrl = buildWhatsAppShareUrl(item, canonicalUrl);
  const liveTiers = liveProgress.tiers.length > 0 ? liveProgress.tiers : initialProgress.tiers;
  const currentPrice = liveProgress.tierProgress.currentPricePerUnit || item.currentTierPrice;
  const displayDistanceKm = routeSummary?.distanceKm ?? item.distanceKm;
  const displayDurationMinutes = routeSummary?.durationMinutes ?? item.estimatedPickupMinutes;
  const distanceSourceLabel =
    routeSummary?.source === "straight_line_fallback"
      ? "Perkiraan garis lurus"
      : routeSummary
        ? "Rute berkendara"
        : "Jarak perkiraan";

  return (
    <article className="overflow-hidden border border-wesup-ink/15 bg-wesup-paper">
      <div className="relative aspect-[16/8] w-full overflow-hidden bg-wesup-paper-sub sm:aspect-[16/7] lg:aspect-[16/6]">
        <Image
          src={item.imageUrl}
          alt={`Foto produk ${item.title}`}
          fill
          sizes="(min-width: 1024px) 768px, 100vw"
          className="object-cover"
        />
        <div className="absolute top-4 left-4 bg-wesup-paper px-3 py-1.5 text-xs font-semibold text-wesup-ink-sub border border-wesup-ink/15">
          {item.category}
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 tabular-nums">
        {isUmkm && needsProfileLocation ? (
          <div className="flex flex-col gap-3 border border-wesup-ink/15 bg-wesup-paper p-4 text-sm text-wesup-ink sm:flex-row sm:items-center sm:justify-between tabular-nums" role="status" aria-live="polite">
            <p><strong>Lokasi usaha belum tersimpan.</strong> Jarak sementara dihitung dari pusat Bandung.</p>
            <Link href={`/umkm/onboarding?returnTo=/marketplace/${encodeURIComponent(item.id)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center bg-wesup-ink px-4 py-2.5 text-sm font-bold text-wesup-paper hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Simpan lokasi</Link>
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl md:text-3xl text-wesup-ink leading-tight font-landing-display font-normal uppercase tracking-[0.04em]">
            {item.title}
          </h1>
          <p className="mt-2 text-base font-medium text-wesup-ink-sub">{item.supplierName}</p>
          <div className="mt-1.5">
            <SupplierRatingBadge rating={item.supplierRating ?? null} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="flex items-start gap-3 p-4 bg-wesup-paper border border-wesup-ink/10 tabular-nums">
            <MapPin aria-hidden="true" className="w-5 h-5 text-wesup-ink-sub mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-wesup-ink">Titik kumpul Supplier</p>
              <p className="text-sm text-wesup-ink-sub">{item.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-wesup-paper border border-wesup-ink/10 tabular-nums">
            <Clock aria-hidden="true" className="w-5 h-5 text-wesup-ink-sub mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-wesup-ink">Estimasi & Jarak</p>
              <p className="text-sm text-wesup-ink-sub">
                {displayDistanceKm === null
                  ? "Jarak belum tersedia"
                  : routeSummary
                    ? `${distanceSourceLabel}: ${displayDistanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`
                    : `${displayDistanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`}
                {" • "}
                {displayDurationMinutes === null
                  ? "Estimasi belum tersedia"
                  : `${displayDurationMinutes} mnt (${routeSummary?.source === "osrm" ? "Berkendara" : "Pickup"})`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 tabular-nums">
          <div className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider text-wesup-ink-sub tabular-nums">
            <MapPin aria-hidden="true" className="w-4 h-4" />
            <span>Lokasi Titik Kumpul</span>
          </div>
          <MarketplaceRouteSection
            batchId={item.id}
            viewerCanRoute={viewerCanRoute}
            pickupLatitude={item.pickupLatitude}
            pickupLongitude={item.pickupLongitude}
            pickupAddress={item.pickupAddress}
            onRouteLoaded={handleRouteLoaded}
          />
        </div>

        <div className="flex flex-col gap-2 p-4 bg-wesup-paper border border-wesup-ink/10 tabular-nums">
          <div className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider text-wesup-ink-sub tabular-nums">
            <Tag aria-hidden="true" className="w-4 h-4" />
            <span>Tier Diskon</span>
          </div>
          <div className="flex items-end gap-3 tabular-nums">
            <span className="text-3xl font-black text-wesup-ink tracking-tight">
              {rupiahFormatter.format(currentPrice)}
            </span>
            <span className="text-sm font-medium text-wesup-ink-sub line-through mb-1">
              {rupiahFormatter.format(item.basePrice)}
            </span>
          </div>
        </div>

        <TierProgressBar
          registeredQuantity={liveProgress.registeredQuantity}
          tiers={liveTiers}
          tierProgress={liveProgress.tierProgress}
          targetQuantity={item.targetQuantity}
          showPrice={false}
        />
        <p className="-mt-4 text-xs font-medium text-wesup-ink-sub">
          Tutup pendaftaran: {formatClosingTime(liveProgress.registrationClosesAt)}
          {isRefreshing ? " • Memperbarui…" : ""}
        </p>
        {progressError ? (
          <p className="-mt-3 text-xs font-medium text-wesup-ink-sub" role="status" aria-live="polite">
            Progress terakhir ditampilkan. Pembaruan berikutnya akan dicoba otomatis.
          </p>
        ) : null}

        {canJoinBatch ? (
          <LocationConsentCheckbox onChange={(checked) => setConsentGiven(checked)} />
        ) : null}

        <div className="sticky bottom-[4.75rem] z-10 -mx-4 flex flex-col items-stretch gap-3 border-t border-wesup-ink/15 bg-wesup-paper px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:px-0 sm:py-2">
          {!canJoinBatch&&item.policyVersion===2&&<JoinIntentQuantity item={item}/>}
          {canJoinBatch ? (
            <div className="flex-1 tabular-nums">
              <JoinBatchForm
                item={item}
                consentGiven={consentGiven}
                onSuccess={({ count }) => applyRegistration(count)}
              />
            </div>
          ) : isUmkm ? (
            <Link
              href={`/umkm/onboarding?returnTo=/marketplace/${encodeURIComponent(item.id)}`}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-wesup-ink px-4 py-3 text-sm font-bold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red tabular-nums"
            >
              Lengkapi profil untuk Mendaftar
            </Link>
          ) : viewerRole === null ? (
            <Link
              href={`/login?role=umkm&returnTo=/marketplace/${encodeURIComponent(item.id)}`}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-wesup-ink px-4 py-3 text-sm font-bold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red tabular-nums"
            >
              <LogIn aria-hidden="true" className="w-4 h-4" />
              Masuk sebagai UMKM untuk Mendaftar
            </Link>
          ) : (
            <div className="flex-1 inline-flex items-center justify-center gap-2 border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-sm font-semibold text-wesup-ink-sub tabular-nums">
              Pendaftaran hanya untuk akun UMKM.
            </div>
          )}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-sm font-semibold text-wesup-ink-sub hover:bg-wesup-paper transition-colors"
          >
            <Share2 aria-hidden="true" className="w-4 h-4" />
            Bagikan via WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
