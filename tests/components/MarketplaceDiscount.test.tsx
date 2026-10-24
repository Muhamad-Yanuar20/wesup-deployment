// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import ProductCard from "@/components/marketplace/ProductCard";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { mapMarketplaceRpcRow } from "@/lib/marketplace/api-mapper";

vi.mock("@/components/marketplace/MarketplaceRouteSection", () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))));
afterEach(() => vi.unstubAllGlobals());

describe.each(["card", "detail"])("%s actual tier discount", surface => {
  it.each([
    { quantity: 1, tierOnePrice: 43000, tierTwoPrice: 40000, current: 43000, strike: false, label: "tier 1 at the base price" },
    { quantity: 25, tierOnePrice: 43000, tierTwoPrice: 40000, current: 40000, strike: true, label: "tier 2 with a lower price" },
    { quantity: 25, tierOnePrice: 43000, tierTwoPrice: 43000, current: 43000, strike: false, label: "tier 2 without an actual price reduction" },
    { quantity: 1, tierOnePrice: 40000, tierTwoPrice: 38000, current: 40000, strike: false, label: "tier 1 even when base-price metadata differs" },
  ])("renders $label correctly", ({ quantity, tierOnePrice, tierTwoPrice, current, strike }) => {
    const item = { ...mapMarketplaceRpcRow({ id: "batch", title: "Beras", registered_quantity: quantity, current_price_per_unit: current, can_register: true, remaining_quantity: 99, server_time: "2026-10-24T00:00:00Z", registration_closes_at: "2099-10-25T00:00:00Z", tiers: [{ tier_number: 1, min_volume: 1, max_volume: 24, price_per_unit: tierOnePrice }, { tier_number: 2, min_volume: 25, max_volume: null, price_per_unit: tierTwoPrice }] } as never), basePrice: 43000 };
    const { container } = render(surface === "card" ? <ProductCard item={item} /> : <MarketplaceDetailClient item={item} canonicalUrl="https://example.com/marketplace/batch" viewerRole={null} />);
    expect(container.querySelectorAll(".line-through")).toHaveLength(strike ? 1 : 0);
    expect(container.textContent).toContain(current === 43000 ? "43.000" : "40.000");
  });
});
