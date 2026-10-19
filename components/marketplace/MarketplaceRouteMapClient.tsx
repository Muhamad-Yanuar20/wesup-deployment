"use client";

import dynamic from "next/dynamic";
import type { MarketplaceRouteResponse } from "@/lib/marketplace/types";

const MarketplaceRouteMap = dynamic(() => import("./MarketplaceRouteMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[320px] items-center justify-center border border-wesup-ink/15 bg-wesup-paper tabular-nums"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-wesup-ink-sub tabular-nums">
        <span className="h-3 w-3 animate-pulse bg-wesup-ink" />
        Menyiapkan rute dari lokasi usaha Anda…
      </div>
    </div>
  ),
});

export default function MarketplaceRouteMapClient({
  route,
}: {
  route: MarketplaceRouteResponse;
}) {
  return <MarketplaceRouteMap route={route} />;
}
