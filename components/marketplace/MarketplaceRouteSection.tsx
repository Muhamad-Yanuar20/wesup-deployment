"use client";

import { useEffect, useState } from "react";
import type { MarketplaceRouteResponse } from "@/lib/marketplace/types";
import MarketplaceRouteMapClient from "./MarketplaceRouteMapClient";
import PickupLocationMapClient from "./PickupLocationMapClient";

export interface MarketplaceRouteSummary {
  source: MarketplaceRouteResponse["route"]["source"];
  distanceKm: number;
  durationMinutes: number | null;
  warning?: string;
}

interface MarketplaceRouteSectionProps {
  batchId: string;
  viewerCanRoute: boolean;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  onRouteLoaded?: (summary: MarketplaceRouteSummary) => void;
}

export default function MarketplaceRouteSection({
  batchId,
  viewerCanRoute,
  pickupLatitude,
  pickupLongitude,
  pickupAddress,
  onRouteLoaded,
}: MarketplaceRouteSectionProps) {
  const [route, setRoute] = useState<MarketplaceRouteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(viewerCanRoute);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerCanRoute) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setRoute(null);

    void fetch(`/api/marketplace/${encodeURIComponent(batchId)}/route`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | MarketplaceRouteResponse
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(body && "error" in body && body.error ? body.error : "Rute belum dapat dimuat.");
        }
        return body as MarketplaceRouteResponse;
      })
      .then((nextRoute) => {
        if (controller.signal.aborted) return;
        setRoute(nextRoute);
        onRouteLoaded?.({
          source: nextRoute.route.source,
          distanceKm: nextRoute.route.distanceKm,
          durationMinutes: nextRoute.route.durationMinutes,
          warning: nextRoute.route.warning,
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Rute belum dapat dimuat.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [batchId, onRouteLoaded, viewerCanRoute]);

  if (!viewerCanRoute) {
    return (
      <PickupLocationMapClient
        latitude={pickupLatitude}
        longitude={pickupLongitude}
        address={pickupAddress}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        data-testid="pickup-location-map"
        className="flex h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm font-medium text-slate-500">Memuat rute dari lokasi usaha Anda…</span>
      </div>
    );
  }

  if (route) {
    return (
      <div>
        <MarketplaceRouteMapClient route={route} />
        {route.route.warning ? (
          <p className="mt-2 text-xs font-medium text-amber-700" role="status" aria-live="polite">
            {route.route.warning}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <PickupLocationMapClient
        latitude={pickupLatitude}
        longitude={pickupLongitude}
        address={pickupAddress}
      />
      <p className="mt-2 text-xs font-medium text-amber-700" role="status" aria-live="polite">
        {error ?? "Rute belum dapat dimuat. Lokasi pickup tetap ditampilkan."}
      </p>
    </div>
  );
}
