// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { renderComponent as render } from "./test-utils";

const DEFAULT_ITEM: MarketplaceItem = {
  id: "item-1",
  slug: "test-slug-1",
  title: "Cabai Merah Premium",
  supplierName: "Mitra Tani Bandung",
  category: "Sayur & Buah",
  imageUrl: "/images/cabai.webp",
  distanceKm: 3.5,
  estimatedPickupMinutes: 25,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 30,
  targetQuantity: 50,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-15T10:00:00.000Z",
  pickupLatitude: -6.9175,
  pickupLongitude: 107.6191,
  pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
};

function makeItem(overrides: Partial<MarketplaceItem> = {}): MarketplaceItem {
  return { ...DEFAULT_ITEM, ...overrides };
}

describe("MarketplaceDetailClient", () => {
  describe("navigation", () => {
    it("renders a back link to marketplace list", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const backLink = screen.getByRole("link", { name: /kembali ke marketplace/i });
      expect(backLink).toHaveAttribute("href", "/marketplace");
    });
  });

  describe("product information", () => {
    it("renders the product title as heading", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cabai Merah Premium");
    });

    it("renders the supplier name", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("Mitra Tani Bandung")).toBeInTheDocument();
    });

    it("renders the category badge", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("Sayur & Buah")).toBeInTheDocument();
    });

    it("renders product image with descriptive alt text", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const img = screen.getByRole("img", { name: /foto produk cabai merah premium/i });
      expect(img).toBeInTheDocument();
    });
  });

  describe("location & distance", () => {
    it("shows the Titik kumpul Supplier section", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("Titik kumpul Supplier")).toBeInTheDocument();
      expect(screen.getAllByText("Jl. Asia Afrika No. 123, Bandung").length).toBeGreaterThan(0);
    });

    it("shows absolute distance with Indonesian decimal formatting", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("3,5 km • 25 mnt (Pickup)")).toBeInTheDocument();
    });
  });

  describe("pricing", () => {
    it("displays currentTierPrice in IDR format", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText(/Rp\s*22\.000/)).toBeInTheDocument();
    });

    it("displays basePrice with strikethrough", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const strikeEl = screen.getByText(/Rp\s*25\.000/);
      expect(strikeEl.className).toContain("line-through");
    });

    it("renders Tier Diskon label", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("Tier Diskon")).toBeInTheDocument();
    });
  });

  describe("progress & registration", () => {
    it("shows correct progress percentage (60%)", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("60%")).toBeInTheDocument();
    });

    it("shows target kelompok count", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("Target Kelompok: 30/50 Porsi")).toBeInTheDocument();
    });

    it("has a progress bar with correct aria attributes", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const bar = screen.getByRole("progressbar", { name: /progres target kelompok/i });
      expect(bar).toHaveAttribute("aria-valuenow", "60");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
    });
  });

  describe("call-to-action buttons", () => {
    it("renders a disabled Daftar Sekarang button", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const btn = screen.getByRole("button", { name: /daftar sekarang/i });
      expect(btn).toBeDisabled();
    });

    it("renders a WhatsApp share link with correct href", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const shareLink = screen.getByRole("link", { name: /bagikan via whatsapp/i });
      expect(shareLink).toHaveAttribute("target", "_blank");
      expect(shareLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(shareLink.getAttribute("href")).toContain("https://wa.me/?text=");
    });

    it("encodes the product title into the WhatsApp message", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      const shareLink = screen.getByRole("link", { name: /bagikan via whatsapp/i });
      const href = shareLink.getAttribute("href")!;
      const decoded = decodeURIComponent(href);
      expect(decoded).toContain("Cabai Merah Premium");
    });
  });

  describe("location consent", () => {
    it("shows the location consent section heading", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText("Persetujuan Lokasi Pengambilan")).toBeInTheDocument();
    });

    it("shows the consent text about self-pickup", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByText(/self-pickup/i)).toBeInTheDocument();
      expect(screen.getByText(/secara mandiri/i)).toBeInTheDocument();
    });

    it("keeps Daftar button disabled until consent is given", async () => {
      const user = userEvent.setup();
      render(<MarketplaceDetailClient item={makeItem()} />);
      const btn = screen.getByRole("button", { name: /daftar sekarang/i });
      const checkbox = screen.getByRole("checkbox", { name: /saya menyetujui lokasi pengambilan/i });

      expect(btn).toBeDisabled();

      await user.click(checkbox);

      expect(btn).toBeEnabled();
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("shows a consent timestamp after checking the checkbox", async () => {
      const user = userEvent.setup();
      render(<MarketplaceDetailClient item={makeItem()} />);
      const checkbox = screen.getByRole("checkbox", { name: /saya menyetujui lokasi pengambilan/i });

      expect(screen.queryByText(/disetujui:/i)).not.toBeInTheDocument();

      await user.click(checkbox);

      expect(screen.getByText(/disetujui:/i)).toBeInTheDocument();
    });

    it("renders the pickup location map", () => {
      render(<MarketplaceDetailClient item={makeItem()} />);
      expect(screen.getByTestId("pickup-location-map")).toBeInTheDocument();
    });
  });
});
