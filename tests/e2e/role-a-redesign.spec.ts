import { test, expect, request, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";

const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
const configured = Boolean(env.DATABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const batchId = crypto.randomUUID();
const password = "role-a-disposable-fixture-42";
const owners: Record<string, string> = {};
const cookies: Record<string, Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>["cookies"]> = {};
const item = { id: batchId, title: "Beras Uji Role A", supplierName: "Gudang Uji Role A", category: "Beras & Biji-bijian", imageUrl: "/file.svg", distanceKm: 1.2, estimatedPickupMinutes: 4, basePrice: 15000, currentTierPrice: 15000, registeredQuantity: 1, targetQuantity: 30, status: "ACTIVE", registrationClosesAt: new Date(Date.now() + 86400000).toISOString(), pickupLatitude: -6.914744, pickupLongitude: 107.60981, pickupAddress: "Jl. Uji, Bandung", tiers: [{ tierNumber: 1, minVolume: 1, maxVolume: 29, pricePerUnit: 15000 }, { tierNumber: 2, minVolume: 30, maxVolume: null, pricePerUnit: 13000 }] };
const finance = { balances: { escrow: 500000, frozen: 100000, available: 200000, paidOut: 300000 }, accounts: [{ id: crypto.randomUUID(), bank_name: "Bank Uji", account_number: "0012345678", account_holder_name: "Penerima Uji", is_primary: true }], payouts: [{ id: crypto.randomUUID(), amount: 300000, status: "paid", requested_at: new Date().toISOString() }] };
let pool: Pool;

async function asRole(page: Page, role?: string) {
  await page.context().clearCookies();
  if (role) await page.context().addCookies(cookies[role]);
}
async function inspect(page: Page, name: string, width: number, outputPath: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator("nextjs-portal").evaluateAll(elements => elements.forEach(el => el.remove()));
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflowing) {
    const offenders = await page.locator("body *").evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, className: el.getAttribute("class"), right: el.getBoundingClientRect().right })));
    expect(offenders, `${name} overflows at ${width}px`).toEqual([]);
  }
  const legacyBlue = await page.locator(".wesup-app *").evaluateAll(elements => elements.flatMap(element => {
    if (element.closest(".leaflet-container")) return [];
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return [];
    const style = getComputedStyle(element);
    const colors = [style.color, style.backgroundColor, style.borderTopColor];
    const blue = colors.find(color => {
      const channels = color.match(/[\d.]+/g)?.map(Number);
      return channels && channels.length >= 3 && (channels.length < 4 || channels[3] > 0) && channels[2] > channels[0] + 20 && channels[2] > channels[1] + 10;
    });
    return blue ? [{ tag: element.tagName, color: blue, text: element.textContent?.trim().slice(0, 45) }] : [];
  }).slice(0, 8));
  expect(legacyBlue, `${name} retains legacy blue chrome at ${width}px`).toEqual([]);
  await page.screenshot({ path: outputPath, fullPage: true, animations: "disabled" });
  // Historical/approved evidence is never silently overwritten by a test run.
  if (process.env.ROLE_A_CAPTURE_EVIDENCE === "1") await page.screenshot({ path: `node_modules/.cache/role-a/refinement-${name}-${width}.png`, fullPage: true, animations: "disabled" });
}

test("shared login form keeps admin login readable", async ({ page }) => {
  await page.goto("/admin/login");
  const heading = page.getByRole("heading", { level: 1, name: "Login Admin" });
  await expect(heading).toBeVisible();
  const contrast = await heading.evaluate(element => {
    const main = element.closest("main")!;
    const context = document.createElement("canvas").getContext("2d")!;
    function luminance(color: string) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const rgb = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }
    const text = luminance(getComputedStyle(element).color);
    const background = luminance(getComputedStyle(main).backgroundColor);
    return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test.describe("Role A responsive redesign with disposable fixtures", () => {
  test.skip(!configured, "Requires disposable Supabase fixture access.");
  test.use({ httpCredentials: { username: env.SWAGGER_USERNAME ?? "", password: env.SWAGGER_PASSWORD ?? "" } });
  test.beforeAll(async () => {
    mkdirSync("docs/testing/role-a", { recursive: true });
    pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
    for (const role of ["supplier", "umkm"]) {
      const email = `role-a-${crypto.randomUUID()}@example.com`;
      const auth = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await auth.auth.signUp({ email, password });
      if (data.user) owners[role] = data.user.id;
      if (error || !data.session || !data.user) throw new Error("Disposable role A account could not be created.");
      await pool.query("update public.profiles set role=$1,status='active',full_name='QA Role A' where id=$2", [role, data.user.id]);
      if (role === "supplier") await pool.query("insert into public.supplier_profiles(user_id,business_name,address,latitude,longitude,ktp_photo_url,nik,verification_status) values($1,'Gudang Uji Role A','Jl. Uji, Bandung',-6.914744,107.60981,'https://example.com/role-a.webp',$2,'approved')", [data.user.id, `role-a-${data.user.id}`]);
      else await pool.query("insert into public.umkm_profiles(user_id,business_name,address,latitude,longitude) values($1,'UMKM Uji Role A','Jl. Uji, Bandung',-6.914744,107.60981)", [data.user.id]);
      const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100" });
      try {
        const response = await api.post("/api/auth/login", { data: { email, password, role } });
        expect(response.status()).toBe(200);
        cookies[role] = (await api.storageState()).cookies;
      } finally { await api.dispose(); }
    }
    await pool.query("insert into public.batches(id,supplier_id,title,description,category,min_quantity,capacity_quantity,unit,status,transaction_policy_version,pickup_name,pickup_address,latitude,longitude,product_photo_url) values($1,$2,'Beras Uji Role A','Penawaran uji antarmuka.','Beras & Biji-bijian',1,100,'kg','published',1,'Gudang Uji','Jl. Uji, Bandung',-6.914744,107.60981,'/file.svg')", [batchId, owners.supplier]);
    await pool.query("insert into public.batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at) values($1,now()-interval '1 hour',now()+interval '1 day',now()+interval '25 hours',now()+interval '49 hours',now()+interval '3 days')", [batchId]);
    await pool.query("insert into public.batch_tiers(batch_id,tier_number,min_volume,max_volume,price_per_unit) values($1,1,1,29,15000),($1,2,30,null,13000)", [batchId]);
    await pool.query("insert into public.registrations(batch_id,umkm_id,quantity,status,consented_at,consent_latitude,consent_longitude) values($1,$2,1,'registered',now(),-6.914744,107.60981)", [batchId, owners.umkm]);
  });
  test.afterAll(async () => {
    try {
      if (pool) {
        await pool.query("delete from public.registrations where batch_id=$1", [batchId]);
        await pool.query("delete from public.batches where id=$1", [batchId]);
        for (const id of Object.values(owners)) await pool.query("delete from auth.users where id=$1", [id]);
      }
    } finally { await pool?.end(); }
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`all fourteen routes, recovery and keyboard at ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(240000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      page.setDefaultTimeout(15000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      // Browser-visible APIs use deterministic test responses. Auth guards and
      // initial detail/status/support server reads still use the real fixture.
      await page.route("**/*.tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#EAE8E3" d="M0 0h256v256H0z"/><path stroke="#F4F4F0" stroke-width="14" d="M0 80h256M100 0v256"/></svg>' }));
      await page.route("**/file.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><path fill="#EAE8E3" d="M0 0h800v500H0z"/><path fill="#d9c7a4" stroke="#050505" stroke-width="3" d="M270 90h260l30 320H240z"/><text x="400" y="255" text-anchor="middle" font-family="monospace" font-size="44">BERAS</text><path stroke="#E61919" stroke-width="5" d="M300 290h200"/></svg>' }));
      let searchFails = false;
      await page.route("**/api/marketplace/search?*", route => route.fulfill({ status: searchFails ? 500 : 200, json: searchFails ? { error: "Pencarian belum dapat dimuat." } : { items: [item], total: 1, page: 1, pageSize: 12, totalPages: 1, origin: { latitude: -6.914744, longitude: 107.60981, source: "bandung_default", needsProfileLocation: false } } }));
      await page.route(`**/api/batches/${batchId}/progress`, route => route.fulfill({ json: { batchId, status: "published", registeredQuantity: 1, tiers: item.tiers, tierProgress: { currentTierNumber: 1, currentPricePerUnit: 15000, nextTierNumber: 2, nextTierMinVolume: 30, remainingToNextTier: 29, progressPercent: 3 }, registrationClosesAt: item.registrationClosesAt, serverTime: new Date().toISOString() } }));
      await page.route(`**/api/marketplace/${batchId}/route`, route => route.fulfill({ json: { batchId, origin: { latitude: -6.914744, longitude: 107.60981, label: "Lokasi usaha Anda" }, destination: { latitude: -6.914744, longitude: 107.60981, address: "Jl. Uji, Bandung" }, route: { source: "straight_line_fallback", coordinates: [[-6.914744, 107.60981], [-6.915, 107.61]], distanceKm: 1.2, durationMinutes: null, warning: "Perkiraan garis lurus" } } }));
      for (const [url, name] of [["/login", "login"], ["/register", "register"], ["/register/umkm", "umkm-signup"], ["/supplier/register", "supplier-signup"], ["/marketplace", "marketplace"], [`/marketplace/${batchId}`, "detail"], ["/demo/leaflet", "map"], ["/docs", "docs"]]) {
        await asRole(page);
        await page.goto(url);
        if (name === "marketplace") await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
        if (name === "detail") await expect(page.getByRole("heading", { level: 1, name: item.title })).toBeVisible();
        if (name === "docs") await expect(page.locator(".swagger-ui .opblock").first()).toBeVisible();
        if (name === "marketplace" && width < 1024) await page.getByRole("button", { name: "Lihat area pickup" }).click();
        if (["marketplace", "detail", "map"].includes(name)) await expect(page.locator(".leaflet-container").first()).toBeVisible();
        if (name === "marketplace") {
          const markers = page.getByTestId("marketplace-radius-map").locator("path.leaflet-interactive");
          await expect(markers.nth(1)).toHaveAttribute("fill", "#050505");
          await expect(markers.nth(2)).toHaveAttribute("fill", "#E61919");
        }
        await inspect(page, name, width, testInfo.outputPath(`${name}.png`));
      }
      await page.goto("/marketplace");
      if (width < 1024) {
        await page.getByRole("button", { name: "Buka filter pencarian" }).click();
        await expect(page.getByRole("dialog", { name: "Filter Pencarian" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Buka filter pencarian" })).toBeFocused();
      }
      searchFails = true;
      await page.getByLabel("Cari penawaran marketplace").fill("gagal");
      await expect(page.getByRole("alert").filter({ hasText: "Penawaran belum bisa dimuat" })).toBeVisible();
      searchFails = false;
      await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
      await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
      await asRole(page, "supplier");
      await page.route("**/api/suppliers/finance", route => route.fulfill({ json: { item: finance } }));
      await page.route("**/api/suppliers/finance/payouts", async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.fulfill({ status: 409, json: { error: "Saldo tersedia tidak mencukupi.", code: "INSUFFICIENT_AVAILABLE_BALANCE" } }); });
      await page.route("**/api/suppliers/notifications", route => route.request().method() === "PATCH" ? route.fulfill({ json: { ok: true } }) : route.fulfill({ json: { notifications: [{ id: "test-notification", type: "batch_update", title: "Batch diperbarui", message: "Jadwal pickup sudah tersedia.", readAt: null, createdAt: new Date().toISOString(), href: "/supplier" }] } }));
      for (const [url, name, heading] of [["/supplier/keuangan", "finance", "Keuangan Supplier"], ["/supplier/akun/escrow", "escrow", "Monitoring Escrow"], ["/supplier/akun/rekening", "bank", "Rekening Supplier"], ["/supplier/notifikasi", "notifications", "Notifikasi"]]) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expect(page.getByRole("button", { name: "Keluar", exact: true })).toBeVisible();
        await inspect(page, name, width, testInfo.outputPath(`${name}.png`));
      }
      await page.getByRole("button", { name: "Tandai semua dibaca" }).click();
      await expect(page.getByText("Semua sudah dibaca", { exact: true })).toBeVisible();
      await page.goto("/supplier/keuangan");
      await page.getByLabel("Nominal transfer (Rp)").fill("500000");
      const opener = page.getByRole("button", { name: "Ajukan transfer", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Ajukan transfer?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Ajukan transfer", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("Saldo tersedia tidak mencukupi");
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
      await expect(opener).toHaveCSS("outline-style", "solid");
      await pool.query("update public.supplier_profiles set verification_status='pending' where user_id=$1", [owners.supplier]);
      try { await page.goto("/supplier/status"); await inspect(page, "supplier-status", width, testInfo.outputPath("supplier-status.png")); }
      finally { await pool.query("update public.supplier_profiles set verification_status='approved' where user_id=$1", [owners.supplier]); }
      await asRole(page, "umkm");
      await page.goto("/bantuan");
      await expect(page.getByText(/Pesanan [a-f0-9]{8}/).first()).toBeVisible();
      await inspect(page, "help", width, testInfo.outputPath("help.png"));
      // Shared-shell consumers B/C keep their navigation and content readable.
      for (const url of ["/umkm", "/umkm/pesanan"]) {
        await page.goto(url);
        await expect(page.getByRole("navigation", { name: width < 1024 ? "Navigasi bawah (mobile)" : "Navigasi utama", exact: true })).toBeVisible();
        await expect(page.locator("main#main-content")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
        await inspect(page, url === "/umkm" ? "umkm-dashboard" : "umkm-orders", width, testInfo.outputPath(`b-${url.split("/").pop()}.png`));
      }
      await asRole(page, "supplier");
      for (const url of ["/supplier", "/supplier/catalog"]) {
        await page.goto(url);
        await expect(page.getByRole("button", { name: "Keluar", exact: true })).toBeVisible();
        await expect(page.locator("main#main-content")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
        if (url === "/supplier") await expect(page.getByRole("heading", { level: 1, name: /Selamat datang/ })).toBeVisible();
        await inspect(page, url === "/supplier" ? "supplier-dashboard" : "supplier-catalog", width, testInfo.outputPath(`c-${url.split("/").pop()}.png`));
      }
      await asRole(page);
      await page.goto("/admin/login");
      await expect(page.getByRole("heading", { level: 1, name: "Login Admin" })).toBeVisible();
      await expect(page.getByRole("radio")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
});
