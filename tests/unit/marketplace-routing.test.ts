import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOsrmRouteUrl,
  fetchOsrmRoute,
  makeStraightLineFallback,
  resolveMarketplaceRoute,
} from "@/lib/marketplace/routing";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import { GET as getRoute } from "@/app/api/marketplace/[id]/route/route";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fetchMarketplaceDetail } from "@/lib/marketplace/server-repository";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/marketplace/server-repository", () => ({ fetchMarketplaceDetail: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockFetchMarketplaceDetail = vi.mocked(fetchMarketplaceDetail);

const ENDPOINTS = {
  origin: { latitude: -6.914744, longitude: 107.60981 },
  destination: { latitude: -6.95, longitude: 107.7, address: "Gudang Bandung" },
};

const ITEM: MarketplaceItem = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Cabai",
  supplierName: "Supplier",
  category: "Sayur & Buah",
  imageUrl: "/file.svg",
  distanceKm: 3,
  estimatedPickupMinutes: 10,
  basePrice: 1000,
  currentTierPrice: 900,
  registeredQuantity: 1,
  targetQuantity: 10,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-15T10:00:00.000Z",
  pickupLatitude: ENDPOINTS.destination.latitude,
  pickupLongitude: ENDPOINTS.destination.longitude,
  pickupAddress: ENDPOINTS.destination.address,
};

function osrmResponse() {
  return new Response(
    JSON.stringify({
      code: "Ok",
      routes: [
        {
          distance: 12_345,
          duration: 1_234,
          geometry: {
            type: "LineString",
            coordinates: [
              [107.60981, -6.914744],
              [107.65, -6.93],
              [107.7, -6.95],
            ],
          },
        },
      ],
    }),
    { status: 200 },
  );
}

function routeParams(id = ITEM.id) {
  return { params: Promise.resolve({ id }) };
}

describe("marketplace routing adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetServerClient.mockReset();
    mockGetCurrentUser.mockReset();
    mockEnforceRateLimit.mockReset();
    mockFetchMarketplaceDetail.mockReset();
  });

  it("uses OSRM longitude,latitude order and converts geometry for Leaflet", async () => {
    expect(buildOsrmRouteUrl(ENDPOINTS, "https://router.example/")).toBe(
      "https://router.example/route/v1/driving/107.60981,-6.914744;107.7,-6.95?overview=full&geometries=geojson&steps=false&alternatives=false",
    );
    const route = await fetchOsrmRoute(ENDPOINTS, {
      fetchImpl: vi.fn(async () => osrmResponse()),
    });
    expect(route).toMatchObject({
      source: "osrm",
      distanceKm: 12.345,
      durationMinutes: 21,
    });
    expect(route.coordinates).toEqual([
      [-6.914744, 107.60981],
      [-6.93, 107.65],
      [-6.95, 107.7],
    ]);
  });

  it("returns a straight-line route when the provider fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const route = await resolveMarketplaceRoute(ITEM.id, ENDPOINTS, {
      fetchImpl: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    expect(route.route.source).toBe("straight_line_fallback");
    expect(route.route.coordinates).toEqual([
      [-6.914744, 107.60981],
      [-6.95, 107.7],
    ]);
    expect(route.route.warning).toMatch(/perkiraan garis lurus/i);
    expect(warn).toHaveBeenCalledWith("[marketplace/route] OSRM fallback", {
      batchId: ITEM.id,
      code: "http",
    });
  });

  it("builds the fallback route with the expected distance", () => {
    const fallback = makeStraightLineFallback(ENDPOINTS);
    expect(fallback.distanceKm).toBeGreaterThan(0);
    expect(fallback.durationMinutes).toBeNull();
  });
});

describe("GET /api/marketplace/[id]/route", () => {
  const profileQuery = {
    maybeSingle: vi.fn<
      () => Promise<{
        data: { latitude: number; longitude: number } | null;
        error: Error | null;
      }>
    >(async () => ({
      data: { latitude: ENDPOINTS.origin.latitude, longitude: ENDPOINTS.origin.longitude },
      error: null,
    })),
  };
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => profileQuery),
      })),
    })),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetServerClient.mockClear();
    mockGetServerClient.mockResolvedValue(client as never);
    mockEnforceRateLimit.mockResolvedValue(null);
    mockFetchMarketplaceDetail.mockResolvedValue(ITEM);
    vi.stubGlobal("fetch", vi.fn(async () => osrmResponse()));
  });

  it("uses the authenticated UMKM profile and ignores no client origin", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "umkm-1",
      email: "umkm@example.com",
      role: "umkm",
      status: "active",
      fullName: "UMKM",
    });
    const response = await getRoute(new Request("http://localhost"), routeParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.origin).toEqual({
      latitude: ENDPOINTS.origin.latitude,
      longitude: ENDPOINTS.origin.longitude,
      label: "Lokasi usaha Anda",
    });
    expect(mockFetchMarketplaceDetail).toHaveBeenCalledWith(
      client,
      ITEM.id,
      ENDPOINTS.origin,
    );
  });

  it("rejects browser coordinates before touching profile or route data", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "umkm-1",
      email: "umkm@example.com",
      role: "umkm",
      status: "active",
      fullName: "UMKM",
    });
    const response = await getRoute(
      new Request("http://localhost?lat=-7&lng=108"),
      routeParams(),
    );
    expect(response.status).toBe(400);
    expect(mockGetServerClient).not.toHaveBeenCalled();
  });

  it("gates guest, non-UMKM, and missing-location viewers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    expect((await getRoute(new Request("http://localhost"), routeParams())).status).toBe(401);

    mockGetCurrentUser.mockResolvedValue({
      userId: "supplier-1",
      email: "supplier@example.com",
      role: "supplier",
      status: "active",
      fullName: "Supplier",
    });
    expect((await getRoute(new Request("http://localhost"), routeParams())).status).toBe(403);

    mockGetCurrentUser.mockResolvedValue({
      userId: "umkm-2",
      email: "umkm2@example.com",
      role: "umkm",
      status: "active",
      fullName: "UMKM 2",
    });
    profileQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await getRoute(new Request("http://localhost"), routeParams())).status).toBe(409);
  });
});
