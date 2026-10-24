// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { mapMarketplaceRpcRow } from "@/lib/marketplace/api-mapper";

vi.mock("@/components/marketplace/MarketplaceRouteSection", () => ({ default: () => <div data-testid="route" /> }));
afterEach(() => vi.unstubAllGlobals());
describe("closed marketplace detail", () => {
  it.each([['full', 'Kuota batch sudah penuh'], ['expired', 'Masa penawaran telah berakhir'], ['closed', 'Pendaftaran telah ditutup']])("shows only an explanation for %s", (reason, message) => {
    vi.stubGlobal("fetch", vi.fn());
    const item = mapMarketplaceRpcRow({ id: "batch", title: "Beras", supplier_name: "Supplier", batch_status: "closed", can_register: false, unavailable_reason: reason, remaining_quantity: 0, server_time: new Date().toISOString() } as never);
    render(<MarketplaceDetailClient item={item} canonicalUrl="https://example.com/marketplace/batch" viewerRole="umkm" viewerProfileComplete />);
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole("link", { name: /kembali ke marketplace/i })).toHaveAttribute("href", "/marketplace");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("route")).not.toBeInTheDocument();
  });
});
