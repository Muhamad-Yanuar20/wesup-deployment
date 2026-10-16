// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteHeader } from "@/components/landing/sections/SiteHeader";

afterEach(cleanup);

describe("SiteHeader nav bar", () => {
  it("renders the wordmark, desktop links and the primary CTA", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: /wesup/i })).toHaveAttribute("href", "/");
    const nav = screen.getByRole("navigation", { name: /navigasi utama/i });
    expect(within(nav).getByRole("link", { name: /cara kerja/i })).toHaveAttribute(
      "href",
      "#cara-kerja",
    );
    expect(within(nav).getByRole("link", { name: /keunggulan/i })).toHaveAttribute(
      "href",
      "#features",
    );
    expect(screen.getByRole("link", { name: /mulai bergabung/i })).toHaveAttribute(
      "href",
      "/register?role=umkm",
    );
    expect(screen.getByRole("link", { name: /masuk/i })).toHaveAttribute("href", "/login");
  });

  /**
   * The Industrial Print nav is a hard-edged paper bar inset from the top
   * edge, not a rounded glass pill. The surface treatment is the visible
   * signature of the archetype, so it is pinned on the element that carries it.
   */
  it("renders a hard-edged paper bar rather than a rounded glass pill", () => {
    const { container } = render(<SiteHeader />);

    const header = container.querySelector("header") as HTMLElement;
    // The header is a pointer-transparent full-width anchor; the bar itself
    // lives on the inner element.
    expect(header.className).toContain("pointer-events-none");

    const pill = header.querySelector("[data-nav-pill]") as HTMLElement;
    expect(pill.className).toContain("border");
    expect(pill.className).toContain("bg-wesup-paper");
    expect(pill.className).not.toMatch(/rounded-(full|xl|lg|md|sm|2xl|3xl)/);
    expect(pill.className).not.toContain("backdrop-blur");
    expect(pill.className).toContain("max-w-4xl");
  });

  it("exposes a mobile menu toggle wired to the overlay it controls", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: /buka menu navigasi/i });
    const menuId = toggle.getAttribute("aria-controls") as string;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // The overlay owns the id the toggle points at, so aria-controls is never
    // dangling even while the menu is closed.
    expect(document.getElementById(menuId)).not.toBeNull();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const menu = document.getElementById(menuId) as HTMLElement;
    expect(within(menu).getByRole("link", { name: /cara kerja/i })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /panduan umkm/i })).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the menu after navigating away from an in-page link", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: /buka menu navigasi/i });
    await user.click(toggle);

    const menu = document.getElementById(toggle.getAttribute("aria-controls") as string);
    await user.click(within(menu as HTMLElement).getByRole("link", { name: /keunggulan/i }));

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
