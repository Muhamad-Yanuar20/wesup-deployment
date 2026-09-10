"use client";

import dynamic from "next/dynamic";
import type { MarketplaceRouteResponse } from "@/lib/marketplace/types";

const MarketplaceRouteMap = dynamic(() => import("./MarketplaceRouteMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
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
