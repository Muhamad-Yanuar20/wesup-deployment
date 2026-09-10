// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { MarketplaceRouteResponse } from "@/lib/marketplace/types";
import MarketplaceRouteSection from "@/components/marketplace/MarketplaceRouteSection";
import { renderComponent as render } from "./test-utils";

vi.mock("@/components/marketplace/MarketplaceRouteMapClient", () => ({
  default: ({ route }: { route: MarketplaceRouteResponse }) => (
    <div data-testid="marketplace-route-map">
      {route.route.source}:{route.route.distanceKm}
    </div>
  ),
}));

vi.mock("@/components/marketplace/PickupLocationMapClient", () => ({
  default: ({ address }: { address: string }) => (
    <div data-testid="pickup-location-map">{address}</div>
  ),
}));

const ROUTE: MarketplaceRouteResponse = {
  batchId: "batch-1",
  origin: { latitude: -6.91, longitude: 107.61, label: "Lokasi usaha Anda" },
  destination: { latitude: -6.92, longitude: 107.62, address: "Gudang Bandung" },
  route: {
    source: "osrm",
    coordinates: [
      [-6.91, 107.61],
      [-6.92, 107.62],
    ],
    distanceKm: 4.25,
    durationMinutes: 14,
  },
};

const props = {
  batchId: "batch-1",
  viewerCanRoute: true,
  pickupLatitude: ROUTE.destination.latitude,
  pickupLongitude: ROUTE.destination.longitude,
  pickupAddress: ROUTE.destination.address,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MarketplaceRouteSection", () => {
  it("keeps pickup-only rendering for guests and non-UMKM viewers", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<MarketplaceRouteSection {...props} viewerCanRoute={false} />);
    expect(screen.getByTestId("pickup-location-map")).toHaveTextContent("Gudang Bandung");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a route for the active UMKM and reports road metrics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(ROUTE), { status: 200 }),
    );
    const onRouteLoaded = vi.fn();
    render(<MarketplaceRouteSection {...props} onRouteLoaded={onRouteLoaded} />);

    await waitFor(() => expect(screen.getByTestId("marketplace-route-map")).toBeInTheDocument());
    expect(screen.getByTestId("marketplace-route-map")).toHaveTextContent("osrm:4.25");
    expect(onRouteLoaded).toHaveBeenCalledWith({
      source: "osrm",
      distanceKm: 4.25,
      durationMinutes: 14,
      warning: undefined,
    });
  });

  it("falls back to the pickup map and announces an API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Rute belum dapat dimuat." }), { status: 503 }),
    );
    render(<MarketplaceRouteSection {...props} />);

    await waitFor(() => expect(screen.getByTestId("pickup-location-map")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Rute belum dapat dimuat.");
  });
});
