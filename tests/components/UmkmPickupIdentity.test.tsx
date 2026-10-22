// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
it("shows an error and retry instead of an endless skeleton after changing orders", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("order-A") ? new Response(JSON.stringify({ id: "order-A", batchTitle: "Beras A", supplierName: "Supplier A", status: "completed", quantity: 1, unit: "kg", capabilities: { canViewPickup: true }, timeline: {}, pickup: { usedAt: "2026-10-22T00:00:00Z" } }), { status: 200 }) : new Response(JSON.stringify({ error: "Order B unavailable" }), { status: 503 })));
  const view = render(<UmkmOrderDetailClient orderId="order-A" mode="pickup" />);
  await screen.findByText("Serah terima selesai");
  view.rerender(<UmkmOrderDetailClient orderId="order-B" mode="pickup" />);
  expect(await screen.findByText("Pesanan tidak ditemukan.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Coba lagi" })).toBeVisible();
});
