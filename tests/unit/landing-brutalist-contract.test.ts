import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Swiss Industrial Print (light) design contract for the landing surface.
 *
 * Pins: macro display (Archivo Black), paper substrate (#F4F4F0), red-only
 * accent (#E61919), no border-radius/gradients in landing scope, and
 * hero-wash ≡ WebGL cove at paper values.
 */

const read = (...segments: string[]) =>
  readFileSync(join(process.cwd(), ...segments), "utf8");

const LANDING_COMPONENTS = [
  "components/landing/sections/BatchManifest.tsx",
  "components/landing/sections/HowItWorks.tsx",
  "components/landing/sections/Features.tsx",
  "components/landing/sections/ClosingCta.tsx",
  "components/landing/sections/SiteFooter.tsx",
  "components/landing/sections/SiteHeader.tsx",
  "components/landing/scene/HeroScene.tsx",
  "app/page.tsx",
];

describe("landing brutalist design contract", () => {
  it("wires landing display to Archivo Black (macro sans), no Space Grotesk", () => {
    const layout = read("app", "layout.tsx");
    const globals = read("app", "globals.css");

    expect(layout).toMatch(/Archivo_Black/);
    expect(layout).toContain("--font-archivo-black");
    expect(layout).not.toMatch(/Space_Grotesk/);
    expect(layout).not.toMatch(/font-space-grotesk/);
    expect(layout).not.toMatch(/Newsreader|font-newsreader/);
    expect(globals).toContain("--font-landing-display: var(--font-archivo-black)");
    expect(globals).not.toContain("--font-newsreader");
  });

  it("paints landing shell on paper substrate (#F4F4F0), not void", () => {
    const page = read("app", "page.tsx");
    const globals = read("app", "globals.css");

    expect(globals).toContain("--color-wesup-paper: #F4F4F0");
    expect(globals).toMatch(/--color-wesup-paper-sub: #EAE8E3/);
    expect(page).toMatch(/bg-wesup-paper/);
    expect(page).not.toContain("bg-wesup-void");
    expect(page).not.toContain("bg-wesup-ivory");
  });

  it("defines red-only accent (#E61919) as primary accent token", () => {
    const globals = read("app", "globals.css");
    expect(globals).toMatch(/--color-wesup-red: #E61919/);
  });

  it("keeps hero wash channel-equal to WebGL cove at paper values (daylight)", () => {
    const renderer = read("components", "landing", "scene", "renderer.ts");
    const globals = read("app", "globals.css");

    const cove = renderer.match(/const COVE_COLOR\s*=\s*0x([0-9a-fA-F]{6})/)?.[1];
    expect(cove).toBeTruthy();
    if (!cove) return;

    const expected = [
      parseInt(cove.slice(0, 2), 16),
      parseInt(cove.slice(2, 4), 16),
      parseInt(cove.slice(4, 6), 16),
    ].join(" ");

    expect(cove.toLowerCase()).toBe("f4f4f0");
    expect(globals).toContain(`--hero-wash: ${expected}`);
  });

  it("has no border-radius or gradients in landing scope", () => {
    for (const file of LANDING_COMPONENTS) {
      const src = read(file);
      expect(src).not.toMatch(/rounded-(full|xl|lg|md|sm|2xl|3xl)/);
      expect(src).not.toMatch(/rounded-\[/);
      expect(src).not.toMatch(/bg-gradient-to-/);
      expect(src).not.toMatch(/radial-gradient/);
    }
  });

  it("keeps landing-scoped styling off shared chrome (no ivory bleed)", () => {
    const landingComponents = LANDING_COMPONENTS.filter((f) => f !== "app/page.tsx");
    for (const file of landingComponents) {
      expect(read(file)).not.toContain("bg-wesup-ivory");
    }
  });

  it("centres the desktop hero column and widens it for the enlarged type", () => {
    const globals = read("app", "globals.css");
    expect(globals).toContain("justify-content: safe center");
    expect(globals).toContain("max-width: min(36rem, 38vw)");
    // The static fallback must still top-align its stacked story — the safe
    // centring applies to the live scene column, never the degraded layout.
    expect(globals).toMatch(
      /\[data-webgl="off"\] \.hero-scene__column\s*\{[^}]*justify-content:\s*flex-start/,
    );
  });
});
