import { readFileSync, readdirSync } from "node:fs";
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

const filesIn = (directory: string): string[] => readdirSync(join(process.cwd(), directory), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(`${directory}/${entry.name}`) : entry.name.endsWith(".tsx") ? [`${directory}/${entry.name}`] : []);

const ROLE_A_COMPONENTS = [
  ...["components/auth", "components/layout", "components/marketplace", "components/maps", "components/demo", "components/supplier/finance", "components/supplier/steps"].flatMap(filesIn),
  "components/supplier/SupplierRegistrationForm.tsx",
  "components/supplier/SupplierRegistrationStepper.tsx",
  "components/supplier/BusinessPhotoField.tsx",
  "components/supplier/SupplierLocationMap.tsx",
  "components/supplier/SupplierLocationMapClient.tsx",
  "components/supplier/RegistrationSuccessDialog.tsx",
  "components/supplier/SupplierNotificationsClient.tsx",
  "components/supplier/SupplierModuleUnavailable.tsx",
  "app/login/page.tsx", "app/register/page.tsx", "app/register/umkm/page.tsx",
  "app/supplier/register/page.tsx", "app/supplier/status/page.tsx",
  "app/marketplace/page.tsx", "app/marketplace/[id]/page.tsx",
  "app/marketplace/loading.tsx", "app/marketplace/[id]/loading.tsx", "app/marketplace/error.tsx",
  "app/bantuan/page.tsx", "app/docs/page.tsx", "app/docs/SwaggerUiClient.tsx", "app/docs/loading.tsx", "app/docs/error.tsx", "app/demo/leaflet/page.tsx",
  "app/supplier/(dashboard)/keuangan/page.tsx", "app/supplier/(dashboard)/akun/escrow/page.tsx", "app/supplier/(dashboard)/akun/rekening/page.tsx", "app/supplier/notifikasi/page.tsx",
  "app/supplier/(dashboard)/layout.tsx", "app/umkm/layout.tsx", "app/pesanan/layout.tsx",
];

const LANDING_COMPONENTS = [
  ...ROLE_A_COMPONENTS,
  // Landing surface
  "components/landing/sections/BatchManifest.tsx",
  "components/landing/sections/HowItWorks.tsx",
  "components/landing/sections/Features.tsx",
  "components/landing/sections/ClosingCta.tsx",
  "components/landing/sections/SiteFooter.tsx",
  "components/landing/sections/SiteHeader.tsx",
  "components/landing/scene/HeroScene.tsx",
  "app/page.tsx",
  // Person B — buyer journey + supplier account
  "app/umkm/page.tsx",
  "app/umkm/onboarding/page.tsx",
  "app/umkm/akun/page.tsx",
  "app/umkm/notifikasi/page.tsx",
  "app/umkm/pesanan/page.tsx",
  "app/umkm/pesanan/[orderId]/page.tsx",
  "app/pesanan/[orderId]/bayar/page.tsx",
  "app/pesanan/[orderId]/serah-terima/page.tsx",
  "app/pesanan/[orderId]/komplain/page.tsx",
  "app/pesanan/[orderId]/sengketa/page.tsx",
  "app/pesanan/[orderId]/nilai/page.tsx",
  "app/pesanan/[orderId]/refund/rekening/page.tsx",
  "app/supplier/akun/page.tsx",
  "components/umkm/UmkmDashboardClient.tsx",
  "components/umkm/UmkmAccountClient.tsx",
  "components/umkm/UmkmNotificationsClient.tsx",
  "components/umkm/UmkmOnboardingForm.tsx",
  "components/umkm/UmkmOrdersClient.tsx",
  "components/umkm/UmkmOrderDetailClient.tsx",
  "components/orders/TransactionOverview.tsx",
  "components/orders/TransactionSupport.tsx",
  "components/orders/EarlyPaymentDecision.tsx",
  "components/orders/PickupQrBlock.tsx",
  "components/orders/PickupCredentialClient.tsx",
  "components/orders/OrderCenterClient.tsx",
  "components/payments/UmkmPaymentPanel.tsx",
  "components/payments/PaymentInvoiceCard.tsx",
  "components/payments/PaymentWindowClient.tsx",
  "components/payments/QrisPaymentMock.tsx",
  "components/payments/PaymentCountdown.tsx",
  "components/payments/HitAndRunBanner.tsx",
  "components/ratings/RatingFormClient.tsx",
  "components/feedback/core.tsx",
  "components/feedback/ConfirmDialog.tsx",
  "components/ui/EmptyState.tsx",
  "components/ui/SkeletonLoading.tsx",
];

describe("landing brutalist design contract", () => {
  it.each(ROLE_A_COMPONENTS)("keeps role A on paper, ink and red without legacy decoration: %s", file => {
    const src = read(file);
    expect(src).not.toMatch(/\b(?:rounded(?:-[\w\[\].%-]+)?|shadow(?:-[^\s"'`]+)?|backdrop-blur(?:-[^\s"'`]+)?)\b/);
    expect(src).not.toMatch(/\b(?:bg|text|border|ring|outline|divide|decoration|accent|placeholder:text|caret)-(?:slate|blue|gray|zinc|emerald|amber|green|yellow|teal|indigo|purple|orange|rose|cyan|sky|lime|violet|fuchsia|pink|stone|neutral|red)-\d+/);
    expect(src).not.toMatch(/\b(?:bg|text|border)-white\b|radial-gradient|linear-gradient|bg-gradient-to-/);
    expect(src).not.toMatch(/#(?:2563eb|ffffff|dbeafe)\b/i);
  });

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
