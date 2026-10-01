// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { NavigationBar } from "@/components/layout/NavigationBar";
import { NavigationSessionProvider } from "@/components/auth/NavigationSessionProvider";
import { renderComponent } from "./test-utils";

import type { UserAccessState } from "@/lib/auth/access-state";
function render(ui: React.ReactElement, state: UserAccessState | null = null) {
  return renderComponent(<NavigationSessionProvider initialAccessState={state}>{ui}</NavigationSessionProvider>);
}

const navigation = vi.hoisted(() => ({ pathname: "/", replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, refresh: navigation.refresh }),
}));

describe("NavigationBar", () => {
  beforeEach(() => {
    navigation.pathname = "/";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 401 })));
  });

  it.each(["/supplier/catalog", "/supplier/catalog/new", "/supplier/catalog/offer-id/edit"])(
    "only highlights Katalog on %s in both navigation bars", async (pathname) => {
      navigation.pathname = pathname;
      render(<NavigationBar />, { role: "supplier", status: "active", verificationStatus: "approved" });
      await waitFor(() => expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2));
      for (const nav of screen.getAllByRole("navigation")) {
        expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
        expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Katalog");
      }
    },
  );

  it("does not highlight the dashboard for an unrelated supplier route", async () => {
    navigation.pathname = "/supplier/catalogue";
    render(<NavigationBar />, { role: "supplier", status: "active", verificationStatus: "approved" });
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2));
    for (const nav of screen.getAllByRole("navigation")) {
      expect(nav.querySelector('[aria-current="page"]')).toBeNull();
    }
  });

  it("only highlights Pesanan for a nested UMKM order", async () => {
    navigation.pathname = "/umkm/pesanan/order-id";
    render(<NavigationBar />, { role: "umkm", status: "active", profileComplete: true });
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Pesanan" })).toHaveLength(2));
    for (const nav of screen.getAllByRole("navigation")) {
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
      expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Pesanan");
    }
  });

  it("chooses Status alone when pending supplier links have the same URL", async () => {
    navigation.pathname = "/supplier/status";
    render(<NavigationBar />, { role: "supplier", status: "active", verificationStatus: "pending" });
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Status" })).toHaveLength(2));
    for (const nav of screen.getAllByRole("navigation")) {
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
      expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Status");
    }
  });

  it("shows public links without exposing role workspaces to guests", async () => {
    render(<NavigationBar />);

    expect(screen.getAllByRole("link", { name: /marketplace/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /masuk/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders approved Supplier navigation from the server access state", async () => {
    render(<NavigationBar />, { role: "supplier", status: "active", verificationStatus: "approved" });

    await waitFor(() => expect(screen.getAllByRole("link", { name: /katalog/i })[0]).toHaveAttribute("href", "/supplier/catalog"));
    expect(screen.getAllByRole("link", { name: /pesanan & pengambilan/i })[0]).toHaveAttribute("href", "/supplier/pesanan");
    expect(screen.queryByRole("link", { name: /^masuk$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /keluar/i }).length).toBeGreaterThan(0);
  });
});
