"use client";

import dynamic from "next/dynamic";
import type { MarketplaceRadiusMapProps } from "./MarketplaceRadiusMap";

const MarketplaceRadiusMap = dynamic(() => import("./MarketplaceRadiusMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[320px] items-center justify-center border border-wesup-ink/15 bg-wesup-paper md:h-[380px] tabular-nums"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-wesup-ink-sub tabular-nums">
        <span className="h-3 w-3 animate-pulse bg-wesup-ink" />
        Memuat peta radius…
      </div>
    </div>
  ),
});

export default function MarketplaceRadiusMapClient(props: MarketplaceRadiusMapProps) {
  return <MarketplaceRadiusMap {...props} />;
}
