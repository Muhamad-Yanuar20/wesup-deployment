import { test, expect } from "@playwright/test";

// Run only against tests/helpers/marketplace-fixture-server.mjs.
test.skip(process.env.MARKETPLACE_ISOLATED_E2E !== "1", "Requires the isolated SQL fixture server, never production");
const open = "10000000-0000-4000-8000-000000000001";
const expired = "10000000-0000-4000-8000-000000000002";
const full = "10000000-0000-4000-8000-000000000003";
test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ request }) => { await request.post("http://127.0.0.1:3198/__fixture", { data: { action: "reset" } }); });
test("filters unavailable offers using real SQL and rechecks capacity in an open tab", async ({ page, request }) => {
  await page.goto("/marketplace");
  await expect(page.getByRole("heading", { name: "Beras open", exact: true })).toBeVisible();
  await expect(page.getByText("Beras expired", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Beras full", { exact: true })).toHaveCount(0);
  await request.post("http://127.0.0.1:3198/__fixture", { data: { action: "full" } });
  await expect(page.getByRole("heading", { name: "Beras open", exact: true })).toHaveCount(0, { timeout: 22000 });
});
test("renders closed direct links at every required width without forms or overflow", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "Beras open", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/testing/marketplace-availability/${width}-list.png`, fullPage: true });
    for (const [id, reason] of [[expired, "Masa penawaran telah berakhir"], [full, "Kuota batch sudah penuh"]]) {
      await page.goto(`/marketplace/${id}`);
      await expect(page.getByText(reason, { exact: true })).toBeVisible();
      await expect(page.getByRole("spinbutton")).toHaveCount(0);
      await expect(page.getByRole("checkbox")).toHaveCount(0);
      const back = page.getByRole("link", { name: "Kembali ke marketplace", exact: true });
      await expect(back).toBeVisible();
      expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await back.focus(); await expect(back).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: `docs/testing/marketplace-availability/${width}-closed.png`, fullPage: true });
  }
});
test("an already open detail closes at its server deadline", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3198/__fixture", { data: { action: "expire" } });
  await page.goto(`/marketplace/${open}`);
  await expect(page.getByRole("link", { name: /masuk sebagai umkm untuk mendaftar/i })).toBeVisible();
  await expect(page.getByText("Masa penawaran telah berakhir", { exact: true })).toBeVisible({ timeout: 14000 });
  await expect(page.getByRole("link", { name: /masuk sebagai umkm untuk mendaftar/i })).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
});
