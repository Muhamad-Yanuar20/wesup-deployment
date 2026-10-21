import { test, expect } from "@playwright/test";

test("page headings retain their responsive scale instead of feedback CSS defaults", async ({ page }) => {
  for (const path of ["/login", "/marketplace"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toHaveCSS("font-size", "48px");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toHaveCSS("font-size", "30px");
  }
});

test("application navigation floats clear of the viewport edges and content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/marketplace");
  const banner = page.getByRole("banner");
  await expect(banner).toHaveCSS("position", "fixed");
  const rail = await banner.locator(":scope > div").boundingBox();
  expect(rail!.y).toBeGreaterThanOrEqual(12);
  expect(rail!.x).toBeGreaterThanOrEqual(16);
  expect(rail!.x + rail!.width).toBeLessThanOrEqual(1424);
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(heading!.y).toBeGreaterThan(rail!.y + rail!.height);
});

test("mobile search exposes the map on demand without displacing offers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/marketplace/search?*", route => route.fulfill({ json: {
    items: [], total: 0, page: 1, pageSize: 12, totalPages: 0,
    origin: { latitude: -6.914744, longitude: 107.60981, source: "bandung_default", needsProfileLocation: false },
  } }));
  await page.goto("/marketplace");
  const disclosure = page.getByRole("button", { name: "Lihat area pickup" });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("marketplace-radius-map")).not.toBeVisible();
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("marketplace-radius-map")).toBeVisible();
  await disclosure.click();
  await expect(page.getByTestId("marketplace-radius-map")).not.toBeVisible();
});

test("mobile form controls remain large enough to avoid focus zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, selector] of [["/supplier/register", "#fullName"], ["/marketplace", "#marketplace-search"]]) {
    await page.goto(path);
    await expect(page.locator(selector)).toHaveCSS("font-size", "16px");
  }
});

for (const count of [1, 6]) {
  test(`marketplace gives ${count} offers usable space without narrow empty tracks`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const items = Array.from({ length: count }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, title: `Beras visual ${index + 1}`,
      supplierName: "Mitra Uji", category: "Beras & Biji-bijian", imageUrl: "/file.svg",
      distanceKm: 1, estimatedPickupMinutes: 5, basePrice: 15000, currentTierPrice: 13000,
      registeredQuantity: 5, targetQuantity: 30, status: "ACTIVE", registrationClosesAt: "2026-12-01T10:00:00Z",
      pickupLatitude: -6.914744, pickupLongitude: 107.60981,
    }));
    await page.route("**/api/marketplace/search?*", route => route.fulfill({ json: {
      items, total: count, page: 1, pageSize: 12, totalPages: 1,
      origin: { latitude: -6.914744, longitude: 107.60981, source: "bandung_default", needsProfileLocation: false },
    } }));
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: /^Beras visual/ })).toHaveCount(count);
    const card = page.locator('a').filter({ has: page.getByRole("heading", { name: "Beras visual 1", exact: true }) });
    const bounds = await card.boundingBox();
    const results = await page.getByRole("region", { name: "Hasil Penawaran Marketplace" }).boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(count === 1 ? results!.width * 0.9 : 288);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`supplier wizard keeps all steps and editable values at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/*.tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#EAE8E3" d="M0 0h256v256H0z"/></svg>' }));
    await page.goto("/supplier/register");
    await page.getByRole("button", { name: "Lanjut ke Data Usaha" }).click();
    await expect(page.locator("#fullName")).toBeFocused();
    await page.getByLabel("Nama Lengkap", { exact: true }).fill("Mitra Uji Visual");
    await page.getByLabel("Nomor WhatsApp", { exact: true }).fill("081234567890");
    await page.getByLabel("Email", { exact: true }).fill("role-a-visual@example.com");
    await page.getByLabel("Password", { exact: true }).fill("visual-fixture-42");
    await page.getByLabel("Konfirmasi Password", { exact: true }).fill("visual-fixture-42");
    await page.getByRole("button", { name: "Lanjut ke Data Usaha" }).click();
    await page.getByLabel("Nama Usaha", { exact: true }).fill("Toko Uji Visual");
    await page.getByLabel("Alamat Lengkap", { exact: true }).fill("Jl. Uji Visual No. 1, Bandung");
    await page.getByRole("button", { name: "Lanjut ke Lokasi & Foto" }).click();
    await page.getByRole("button", { name: "Pilih titik tengah peta" }).click();
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d")!; context.fillStyle = "#EAE8E3"; context.fillRect(0, 0, 64, 64);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await page.locator('input[type="file"]').setInputFiles({ name: "toko-uji.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    await expect(page.getByRole("button", { name: "Hapus", exact: true })).toBeVisible();
    await expect.poll(() => page.getByAltText("Pratinjau foto tempat usaha").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
    await page.getByRole("button", { name: "Tinjau Pendaftaran" }).click();
    await expect(page.getByRole("button", { name: "Ya, kirim pendaftaran" })).toBeVisible();
    await expect(page.getByText("Toko Uji Visual", { exact: true })).toBeVisible();
    await expect.poll(() => page.getByAltText("Pratinjau foto tempat usaha").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    if (process.env.ROLE_A_CAPTURE_EVIDENCE === "1") await page.screenshot({ path: `node_modules/.cache/role-a/refinement-wizard-review-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Edit informasi akun" }).click();
    await expect(page.getByLabel("Nama Lengkap", { exact: true })).toHaveValue("Mitra Uji Visual");
  });
}
