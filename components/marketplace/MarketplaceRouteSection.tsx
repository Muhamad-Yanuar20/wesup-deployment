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

function isMarketplaceRouteResponse(value: unknown): value is MarketplaceRouteResponse {
  if (!value || typeof value !== "object") return false;
  const payload = value as { route?: unknown; origin?: unknown; destination?: unknown };
  if (!payload.route || !payload.origin || !payload.destination) return false;
  const route = payload.route as { coordinates?: unknown; distanceKm?: unknown; source?: unknown };
  return (
    Array.isArray(route.coordinates) &&
    typeof route.distanceKm === "number" &&
    (route.source === "osrm" || route.source === "straight_line_fallback")
  );
}

export default function MarketplaceRouteSection({
  batchId,
  viewerCanRoute,
  pickupLatitude,
  pickupLongitude,
  pickupAddress,
  onRouteLoaded,
}: MarketplaceRouteSectionProps) {
  const [requestState, setRequestState] = useState<{
    batchId: string | null;
    route: MarketplaceRouteResponse | null;
    error: string | null;
  }>({ batchId: null, route: null, error: null });

  useEffect(() => {
    if (!viewerCanRoute) return;

    const controller = new AbortController();

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
        if (!isMarketplaceRouteResponse(body)) {
          throw new Error("Rute belum dapat dimuat.");
        }
        return body;
      })
      .then((nextRoute) => {
        if (controller.signal.aborted) return;
        setRequestState({ batchId, route: nextRoute, error: null });
        onRouteLoaded?.({
          source: nextRoute.route.source,
          distanceKm: nextRoute.route.distanceKm,
          durationMinutes: nextRoute.route.durationMinutes,
          warning: nextRoute.route.warning,
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setRequestState({
          batchId,
          route: null,
          error: requestError instanceof Error ? requestError.message : "Rute belum dapat dimuat.",
        });
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

  const route = requestState.batchId === batchId ? requestState.route : null;
  const error = requestState.batchId === batchId ? requestState.error : null;
  const isLoading = viewerCanRoute && requestState.batchId !== batchId;

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
