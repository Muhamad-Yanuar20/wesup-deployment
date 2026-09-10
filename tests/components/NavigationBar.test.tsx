// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { NavigationBar } from "@/components/layout/NavigationBar";
import { renderComponent as render } from "./test-utils";

describe("NavigationBar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 401 })));
  });

  it("shows public links without exposing role workspaces to guests", async () => {
    render(<NavigationBar />);

    expect(screen.getAllByRole("link", { name: /marketplace/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /masuk/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/session", expect.anything()));
  });

  it("switches to approved Supplier navigation from the session access state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      accessState: { role: "supplier", status: "active", verificationStatus: "approved" },
    }), { status: 200 }));
    render(<NavigationBar />);

    await waitFor(() => expect(screen.getAllByRole("link", { name: /katalog/i })[0]).toHaveAttribute("href", "/supplier/catalog"));
    expect(screen.getAllByRole("link", { name: /pesanan & pengambilan/i })[0]).toHaveAttribute("href", "/supplier/pesanan");
    expect(screen.queryByRole("link", { name: /^masuk$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /keluar/i }).length).toBeGreaterThan(0);
  });
});
