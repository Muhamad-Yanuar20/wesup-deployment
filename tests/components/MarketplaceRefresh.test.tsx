// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarketplaceClient from "@/components/marketplace/MarketplaceClient";
import { marketplaceApiRepository, MarketplaceReadError } from "@/lib/marketplace/api-repository";
import { mapMarketplaceRpcRow } from "@/lib/marketplace/api-mapper";
vi.mock("@/lib/marketplace/api-repository", async original => ({ ...await original<typeof import("@/lib/marketplace/api-repository")>(), marketplaceApiRepository: { search: vi.fn() } }));
vi.mock("@/components/marketplace/MarketplaceRadiusMapClient", () => ({ default: () => null }));
const search = vi.mocked(marketplaceApiRepository.search);
const now = "2026-10-24T00:00:00Z";
function result(closes = "2026-10-25T00:00:00Z") {
  return { items: [mapMarketplaceRpcRow({ id: "batch", title: "Beras tersedia", can_register: true, registration_closes_at: closes, server_time: now, remaining_quantity: 5 } as never)], total: 1, totalPages: 1, page: 1, pageSize: 12, serverTime: now, origin: { latitude: -6.9, longitude: 107.6, source: "bandung_default" as const, needsProfileLocation: false } };
}
async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
beforeEach(() => { vi.useFakeTimers(); search.mockReset(); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { vi.useRealTimers(); });
describe("marketplace background availability", () => {
  it("refreshes every fifteen seconds without hiding existing cards", async () => {
    search.mockResolvedValue(result());
    render(<MarketplaceClient />);
    await advance();
    expect(search).toHaveBeenCalledTimes(1);
    search.mockReturnValue(new Promise(() => {}));
    await advance(15000);
    expect(search).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Beras tersedia")).toBeVisible();
    await advance(15000);
    expect(search).toHaveBeenCalledTimes(2);
  });
  it("removes an expired card at the server deadline despite a failed refresh", async () => {
    search.mockResolvedValueOnce(result("2026-10-24T00:00:02Z")).mockRejectedValue(new Error("Koneksi terputus"));
    render(<MarketplaceClient />);
    await advance();
    await advance(2000);
    expect(screen.queryByText("Beras tersedia")).not.toBeInTheDocument();
  });
  it("keeps cards and respects Retry-After when rate limited", async () => {
    search.mockResolvedValueOnce(result()).mockRejectedValue(new MarketplaceReadError("Terlalu banyak permintaan", 45000));
    render(<MarketplaceClient />);
    await advance(); await advance(15000);
    expect(screen.getByText("Beras tersedia")).toBeVisible();
    await advance(30000);
    expect(search).toHaveBeenCalledTimes(2);
  });
  it("pauses in hidden tabs and refreshes on return", async () => {
    search.mockResolvedValue(result());
    render(<MarketplaceClient />); await advance();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await advance(15000); expect(search).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(search).toHaveBeenCalledTimes(2);
  });
  it("expires every card even when the first deadline refresh hangs", async () => {
    const initial = result("2026-10-24T00:00:02Z");
    initial.items.push({ ...initial.items[0], id: "second", title: "Cabai tersedia", registrationClosesAt: "2026-10-24T00:00:04Z" });
    initial.total = 2;
    search.mockResolvedValueOnce(initial).mockReturnValue(new Promise(() => {}));
    render(<MarketplaceClient />); await advance();
    await advance(2000); expect(screen.queryByText("Beras tersedia")).not.toBeInTheDocument();
    expect(screen.getByText("Cabai tersedia")).toBeVisible();
    await advance(2000); expect(screen.queryByText("Cabai tersedia")).not.toBeInTheDocument();
  });
});
