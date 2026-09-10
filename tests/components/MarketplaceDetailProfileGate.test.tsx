// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { renderComponent as render } from "./test-utils";

const item: MarketplaceItem = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Beras Premium",
  supplierName: "Supplier Bandung",
  category: "Makanan Siap Saji",
  imageUrl: "/images/beras.webp",
  distanceKm: 2,
  estimatedPickupMinutes: 20,
  basePrice: 10000,
  currentTierPrice: 9000,
  registeredQuantity: 5,
  targetQuantity: 20,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-30T00:00:00.000Z",
  pickupLatitude: -6.914744,
  pickupLongitude: 107.60981,
  pickupAddress: "Bandung",
};

function renderDetail(viewerRole: "umkm" | "supplier" | "admin" | null, profileComplete?: boolean) {
  return render(
    <MarketplaceDetailClient
      item={item}
      canonicalUrl="http://localhost:3000/marketplace/11111111-1111-4111-8111-111111111111"
      viewerRole={viewerRole}
      viewerProfileComplete={profileComplete}
    />,
  );
}

describe("Marketplace detail profile gate", () => {
  it("sends a guest to UMKM login with a safe returnTo", () => {
    renderDetail(null);
    expect(screen.getByRole("link", { name: /masuk sebagai umkm/i })).toHaveAttribute(
      "href",
      "/login?role=umkm&returnTo=/marketplace/11111111-1111-4111-8111-111111111111",
    );
  });

  it("sends an incomplete UMKM to onboarding for the same batch", () => {
    renderDetail("umkm", false);
    expect(screen.getByRole("link", { name: /lengkapi profil untuk mendaftar/i })).toHaveAttribute(
      "href",
      "/umkm/onboarding?returnTo=/marketplace/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.queryByRole("button", { name: /daftar sekarang/i })).not.toBeInTheDocument();
  });

  it("keeps the quantity and consent join form for a complete UMKM", () => {
    renderDetail("umkm", true);
    expect(screen.getByRole("checkbox", { name: /saya menyetujui lokasi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeInTheDocument();
  });
});
