// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UmkmDashboardClient from "@/components/umkm/UmkmDashboardClient";
import UmkmOrdersClient from "@/components/umkm/UmkmOrdersClient";
import UmkmNotificationsClient from "@/components/umkm/UmkmNotificationsClient";
import UmkmAccountClient from "@/components/umkm/UmkmAccountClient";
import { renderComponent as render } from "./test-utils";

describe("UMKM workspace clients", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows real profile completeness, active order count, next action, and unread count", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      profileComplete: false,
      profile: null,
      activeOrderCount: 2,
      unreadNotificationCount: 3,
      nextAction: { type: "payment", registrationId: "reg-1", batchId: "batch-1", batchTitle: "Beras", dueAt: "2026-09-10T01:00:00Z" },
    }), { status: 200 }));
    render(<UmkmDashboardClient />);

    expect(await screen.findByText(/profil usaha belum lengkap/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/bayar beras/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lengkapi profil/i })).toHaveAttribute("href", "/umkm/onboarding");
  });

  it("renders an informative empty order state from the real orders endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ orders: [] }), { status: 200 }));
    render(<UmkmOrdersClient />);
    expect(await screen.findByText(/belum ada pesanan/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /jelajahi marketplace/i })).toHaveAttribute("href", "/marketplace");
  });

  it("renders user-owned orders without mock fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ orders: [{ id: "reg-1", batchId: "batch-1", batchTitle: "Beras", quantity: 4, status: "paid", finalAmount: 40000, lockedTier: 1, createdAt: "2026-09-09T08:00:00Z" }] }), { status: 200 }));
    render(<UmkmOrdersClient />);
    expect(await screen.findByText("Beras")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("40.000"))).toBeInTheDocument();
  });

  it("loads notifications and marks unread notifications through the API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ notifications: [{ id: "n-1", type: "payment_due", title: "Bayar batch", message: "Batas pembayaran dekat", readAt: null, createdAt: "2026-09-09T08:00:00Z" }] }), { status: 200 }));
    render(<UmkmNotificationsClient />);
    expect(await screen.findByText("Bayar batch")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /tandai semua dibaca/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/umkm/notifications", expect.objectContaining({ method: "PATCH" }));
  });

  it("renders the authenticated user account and real business profile", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ profile: { businessName: "Warung Rina", address: "Jl. Braga", latitude: -6.914744, longitude: 107.60981 } }), { status: 200 }));
    render(<UmkmAccountClient fullName="Rina" email="rina@example.com" />);
    expect(await screen.findByText("Warung Rina")).toBeInTheDocument();
    expect(screen.getByText("rina@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument();
  });
});
