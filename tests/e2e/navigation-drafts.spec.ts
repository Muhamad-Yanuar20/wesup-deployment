import { test, expect, request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { Pool } from "pg";

const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
const hasFixtureAccess = Boolean(env.DATABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Use a disposable supplier, never an existing business account. These journeys
// only edit local recoveries; they do not save or publish an offer to the server.
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`navigation and fresh drafts at ${viewport.width}px`, () => {
    test.skip(!hasFixtureAccess, "Requires the project's live test fixture credentials");
    test.use({ viewport });
    let pool: Pool;
    let ownerId = "";
    let email = "";
    let sessionCookies: Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>["cookies"] = [];
    const password = "navigation-fixture-password-42";

    test.beforeAll(async () => {
      pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
      email = `navigation-${crypto.randomUUID()}@example.com`;
      const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.signUp({ email, password });
      if (data.user) ownerId = data.user.id;
      if (error || !data.session || !ownerId) throw new Error("Could not create the disposable navigation test session");
      await pool.query("update public.profiles set role = 'supplier', status = 'active' where id = $1", [ownerId]);
      await pool.query(`insert into public.supplier_profiles
        (user_id, business_name, address, latitude, longitude, ktp_photo_url, nik, verification_status)
        values ($1, 'Gudang Uji Navigasi', 'Jl. Uji, Bandung', -6.914744, 107.60981,
          'https://example.com/navigation-fixture.webp', $2, 'approved')`, [ownerId, `nav-${ownerId}`]);
      const api = await request.newContext({baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"});
      const login = await api.post("/api/auth/login", {data:{email,password,role:"supplier"}}); expect(login.status()).toBe(200);
      sessionCookies = (await api.storageState()).cookies; await api.dispose();
    });

    test.afterAll(async () => {
      try {
        if (ownerId) await pool.query("delete from auth.users where id = $1", [ownerId]);
      } finally {
        await pool?.end();
      }
    });

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(sessionCookies);
    });

    test("aligns capacity and unit controls while keeping the capacity hint accessible", async ({ page }, testInfo) => {
      await page.goto("/supplier/catalog/new");
      const capacity = page.getByLabel(/Kapasitas maksimum/);
      const unit = page.getByLabel(/Satuan produk/);
      const capacityBox = await capacity.boundingBox();
      const unitBox = await unit.boundingBox();
      expect(capacityBox).not.toBeNull();
      expect(unitBox).not.toBeNull();
      if (viewport.width >= 640) {
        expect(Math.abs(capacityBox!.y - unitBox!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(capacityBox!.height - unitBox!.height)).toBeLessThanOrEqual(1);
      } else {
        expect(unitBox!.y).toBeGreaterThan(capacityBox!.y + capacityBox!.height);
        expect(Math.abs(capacityBox!.x - unitBox!.x)).toBeLessThanOrEqual(1);
      }
      await expect(capacity).toHaveAccessibleDescription("Penerimaan berhenti saat penuh. Jadwal pengambilan tetap.");
      await page.screenshot({ path: testInfo.outputPath("aligned-product-fields.png"), fullPage: true });
    });

    test("retains the complete menu while checking a slow session and after navigation", async ({ page }, testInfo) => {
      let sessionReads = 0;
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/api/auth/session", async route => {
        sessionReads++;
        await pending;
        await route.continue();
      });
      try {
        await page.goto("/supplier/catalog/new", { waitUntil: "domcontentloaded" });
        const nav = page.getByRole("navigation", { name: viewport.width < 768 ? "Navigasi bawah (mobile)" : "Navigasi utama", exact: true });
        await expect(nav).toBeVisible();
        await expect(nav.getByRole("link")).toHaveCount(5);
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(nav.locator('[aria-current="page"]')).toHaveText("Katalog");
        await expect(page.getByRole("link", { name: "Masuk", exact: true })).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath("navigation-slow-session.png"), fullPage: true });
        await nav.getByRole("link", { name: "Notifikasi", exact: true }).click();
        await expect(page).toHaveURL(/\/supplier\/notifikasi$/);
        await expect(nav.getByRole("link")).toHaveCount(5);
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(nav.locator('[aria-current="page"]')).toHaveText("Notifikasi");
        expect(sessionReads).toBe(0);
      } finally {
        release();
      }
    });


    test("navigates after login without waiting for another session request", async ({page}) => {
      await page.context().clearCookies();
      let sessionReads=0,loginWrites=0;
      page.on("request", req=>{if(new URL(req.url()).pathname==="/api/auth/session")sessionReads++;if(new URL(req.url()).pathname==="/api/auth/login")loginWrites++;});
      await page.goto("/login?role=supplier");
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel("Password",{exact:true}).fill(password);
      await page.getByRole("button",{name:"Masuk ke akun"}).click();
      await expect(page).toHaveURL(new RegExp("/supplier$"));
      const nav=page.getByRole("navigation",{name:viewport.width<768?"Navigasi bawah (mobile)":"Navigasi utama",exact:true});
      await expect(nav.getByRole("link",{name:"Katalog",exact:true})).toBeVisible();
      expect(loginWrites).toBe(1);expect(sessionReads).toBe(0);
    });

    test("starts a new offer empty and resumes the previous draft only on request", async ({ page }, testInfo) => {
      await page.addInitScript(({ ownerId }) => {
        const key = `wesup:offer:${ownerId}`;
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
          id: "", revision: null, step: 4, draft: { title: "Draft uji sebelumnya" },
          schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" },
        }));
      }, { ownerId });
      await page.goto("/supplier/catalog/new");
      await expect(page.getByLabel(/Nama Produk/)).toHaveValue("");
      await expect(page.locator('[aria-current="step"]')).toHaveText("1. Produk");
      const resume = page.getByRole("button", { name: "Lanjutkan Draft Draft uji sebelumnya", exact: true });
      await expect(resume).toBeVisible();
      await page.getByLabel(/Nama Produk/).fill("Penawaran uji baru");
      await expect.poll(() => page.evaluate(() => Object.values(localStorage).filter(value => String(value).includes("Penawaran uji baru")).length)).toBe(1);
      const nav = page.getByRole("navigation", { name: viewport.width < 768 ? "Navigasi bawah (mobile)" : "Navigasi utama", exact: true });
      await nav.getByRole("link", { name: "Katalog", exact: true }).click();
      await page.getByRole("link", { name: "Buat Penawaran", exact: true }).click();
      await expect(page.getByLabel(/Nama Produk/)).toHaveValue("");
      await expect(page.getByText("Penawaran uji baru", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("fresh-offer-with-recoveries.png"), fullPage: true });
      await resume.click();
      await expect(page.locator('[aria-current="step"]')).toHaveText("4. Periksa");
      await expect(page.getByRole("heading", { name: "Draft uji sebelumnya", exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox")).not.toBeChecked();
      await expect(page.getByRole("button", { name: "Terbitkan penawaran", exact: true })).toBeDisabled();
      await expect(page.getByRole("status")).toContainText("Foto yang belum tersimpan perlu dipilih kembali");
    });
  });
}
