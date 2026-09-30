import { distanceKm } from "@/lib/geo/service-center";
import type { MarketplaceRouteResponse } from "./types";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const ROUTE_TIMEOUT_MS = 4_000;

interface OsrmRouteResponse {
  code?: unknown;
  routes?: Array<{
    distance?: unknown;
    duration?: unknown;
    geometry?: {
      type?: unknown;
      coordinates?: unknown;
    };
  }>;
}

export interface MarketplaceRouteEndpoints {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number; address: string };
}

export interface MarketplaceRouteFetchOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

export class RouteProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "http" | "timeout" | "invalid" | "no_route",
  ) {
    super(message);
    this.name = "RouteProviderError";
  }
}

function isFiniteCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function asRoadCoordinates(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    throw new RouteProviderError("Invalid route geometry", "invalid");
  }

  // OSRM returns GeoJSON coordinates in [longitude, latitude] order.
  const coordinates = value
    .filter(isFiniteCoordinatePair)
    .map(([longitude, latitude]) => [latitude, longitude] as [number, number]);

  if (coordinates.length < 2) {
    throw new RouteProviderError("Route geometry is empty", "invalid");
  }
  return coordinates;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function buildOsrmRouteUrl(
  endpoints: MarketplaceRouteEndpoints,
  baseUrl = process.env.OSRM_BASE_URL || DEFAULT_OSRM_BASE_URL,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const origin = `${endpoints.origin.longitude},${endpoints.origin.latitude}`;
  const destination = `${endpoints.destination.longitude},${endpoints.destination.latitude}`;
  return `${normalizedBaseUrl}/route/v1/driving/${origin};${destination}?overview=full&geometries=geojson&steps=false&alternatives=false`;
}

export function makeStraightLineFallback(
  endpoints: MarketplaceRouteEndpoints,
  warning = "Rute jalan sedang tidak tersedia. Jarak yang ditampilkan adalah perkiraan garis lurus.",
): MarketplaceRouteResponse["route"] {
  return {
    source: "straight_line_fallback",
    coordinates: [
      [endpoints.origin.latitude, endpoints.origin.longitude],
      [endpoints.destination.latitude, endpoints.destination.longitude],
    ],
    distanceKm: distanceKm(
      endpoints.origin.latitude,
      endpoints.origin.longitude,
      endpoints.destination.latitude,
      endpoints.destination.longitude,
    ),
    durationMinutes: null,
    warning,
  };
}

export async function fetchOsrmRoute(
  endpoints: MarketplaceRouteEndpoints,
  options: MarketplaceRouteFetchOptions = {},
): Promise<MarketplaceRouteResponse["route"]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? ROUTE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildOsrmRouteUrl(endpoints, options.baseUrl), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Wesup marketplace route (+https://wesup.id)",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new RouteProviderError(`OSRM responded with ${response.status}`, "http");
    }
    const body = (await response.json()) as OsrmRouteResponse;
    if (body.code === "NoRoute") {
      throw new RouteProviderError("No route found", "no_route");
    }
    if (body.code !== "Ok" || !body.routes?.[0]) {
      throw new RouteProviderError("Invalid OSRM response", "invalid");
    }

    const route = body.routes[0];
    const distanceMeters = asFiniteNumber(route.distance);
    const durationSeconds = asFiniteNumber(route.duration);
    if (distanceMeters === null || durationSeconds === null) {
      throw new RouteProviderError("Invalid OSRM metrics", "invalid");
    }

    return {
      source: "osrm",
      coordinates: asRoadCoordinates(route.geometry?.coordinates),
      distanceKm: distanceMeters / 1_000,
      durationMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
    };
  } catch (error) {
    if (error instanceof RouteProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RouteProviderError("OSRM request timed out", "timeout");
    }
    throw new RouteProviderError("OSRM request failed", "http");
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveMarketplaceRoute(
  batchId: string,
  endpoints: MarketplaceRouteEndpoints,
  options: MarketplaceRouteFetchOptions = {},
): Promise<MarketplaceRouteResponse> {
  let route: MarketplaceRouteResponse["route"];
  try {
    route = await fetchOsrmRoute(endpoints, options);
  } catch (error) {
    const code = error instanceof RouteProviderError ? error.code : "http";
    console.warn("[marketplace/route] OSRM fallback", { batchId, code });
    route = makeStraightLineFallback(endpoints);
  }

  return {
    batchId,
    origin: { ...endpoints.origin, label: "Lokasi usaha Anda" },
    destination: endpoints.destination,
    route,
  };
}
