import { test, expect, request, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { Pool } from "pg";
const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
const configured = Boolean(env.DATABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const password = "feedback-fixture-password-42";
let pool: Pool;
const accounts: Record<string, { id: string; email: string }> = {};
const orderId = "11111111-1111-4111-8111-111111111111";
const order = { id: orderId, batchId: "22222222-2222-4222-8222-222222222222", batchTitle: "Beras Uji Feedback", batchDisplayCode: "BATCH-UJI", supplierName: "Gudang Uji", batchStatus: "published", quantity: 5, unit: "kg", status: "registered", phase: "waiting_payment_window", presentation: {phase:"waiting_payment_window",label:"Pengumpulan pesanan",explanation:"Harga belum final. Pembayaran dibuka setelah pengumpulan ditutup.",deadlineAt:"2026-10-03T00:00:00Z",group:"ongoing",primaryAction:{label:"Lihat pesanan",href:`/umkm/pesanan/${orderId}`},blockedReason:"Harga final dikunci pada batas pengumpulan."}, finalAmount: null, lockedTier: null, createdAt: "2026-10-01T00:00:00Z", timeline: { registrationClosesAt: "2026-10-03T00:00:00Z", paymentOpensAt: "2026-10-03T00:00:00Z", paymentClosesAt: "2026-10-04T00:00:00Z", estimatedReadyAt: "2026-10-05T01:00:00Z", pickupDeadlineAt: "2026-10-05T12:00:00Z", complaintDeadlineAt: null }, capabilities: { canWithdraw: true, canPay: false, canViewPickup: false, canComplain: false, canTrackDispute: false, canRate: false, canSubmitRefundAccount: false }, invoice: null, pickup: null, escrow: null, dispute: null, rating: null, refund: null, paymentAttempt: null, serverTime: "2026-10-01T00:00:00Z" };
const sessions: Record<string, Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>> = {};
async function login(page: Page, role: string) { await page.context().clearCookies(); await page.context().addCookies(sessions[role].cookies); }
async function shot(page: Page, name: string) { await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({path:`docs/testing/feedback-ui/${name}.png`, fullPage:true, animations:"disabled"}); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
test.describe("feedback UI with disposable accounts", () => {
 test.skip(!configured, "Requires live test fixture credentials");
 test.beforeAll(async () => {
  pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  for (const role of ["supplier", "umkm"]) {
   const email = `feedback-${crypto.randomUUID()}@example.com`;
   const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
   const { data, error } = await client.auth.signUp({ email, password });
   if (data.user) accounts[role] = { id: data.user.id, email };
   if (error || !data.session || !data.user) throw new Error("Disposable feedback fixture could not be created");
   await pool.query("update public.profiles set role = $1, status = 'active' where id = $2", [role, data.user.id]);
   if (role === "supplier") await pool.query("insert into public.supplier_profiles (user_id,business_name,address,latitude,longitude,ktp_photo_url,nik,verification_status) values ($1,'Gudang Uji Feedback','Jl. Uji, Bandung',-6.914744,107.60981,'https://example.com/fixture.webp',$2,'approved')", [data.user.id, `feedback-${data.user.id}`]);
  }
  for (const role of ["supplier", "umkm"]) {
   const api = await request.newContext({baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"});
   const result = await api.post("/api/auth/login",{data:{email:accounts[role].email,password,role}}); expect(result.status()).toBe(200);
   sessions[role] = await api.storageState(); await api.dispose();
  }
 });
 test.afterAll(async () => { try { for (const account of Object.values(accounts)) await pool?.query("delete from auth.users where id = $1", [account.id]); } finally { await pool?.end(); } });
 for (const width of [1440, 768, 390, 320]) {
  test(`recovery, forms and keyboard at ${width}px`, async ({ page }) => {
   test.setTimeout(60000); page.on("pageerror", error => console.log("BROWSER ERROR", error.message)); await page.setViewportSize({ width, height: 1000 });
   await page.emulateMedia({ reducedMotion: "reduce" });
   await login(page, "supplier");
   let fail = true;
   await page.route("**/api/suppliers/finance", async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.fulfill({ status: fail ? 500 : 200, json: fail ? { error: "SQL relation private does not exist" } : { item: { balances: { escrow: 200000, frozen: 0, available: 250000, paidOut: 0 }, accounts: [{ id: "test-bank", bank_name: "Bank Uji", account_number: "123456789", account_holder_name: "Penerima Uji", is_primary: true }], payouts: [] } } }); });
   await page.route("**/api/suppliers/finance/payouts", async route => { await new Promise(resolve => setTimeout(resolve,700)); await route.fulfill({ status: 500, json: { error: "Pengajuan belum dapat diproses. Coba lagi." } }); });
   await page.goto("/supplier/keuangan");
   await expect(page.locator("section[role=alert]")).toContainText("Keuangan belum dapat dimuat", { timeout: 20000 });
   await expect(page.getByText(/SQL relation/)).toHaveCount(0);
   await expect(page.getByText(/Rp\s*0/)).toHaveCount(0);
   await shot(page, `finance-error-${width}`);
   fail = false; await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
   await expect(page.getByLabel("Nama bank", { exact: true })).toBeVisible();
   await page.getByLabel("Nominal transfer (Rp)").fill("100000");
   const opener = page.getByRole("button", { name: "Ajukan transfer", exact: true });
   await opener.click(); const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
   await expect(dialog).toHaveAccessibleDescription(/100.000.*Penerima Uji/);
   await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
   await dialog.getByRole("button", { name: "Ajukan transfer", exact: true }).click();
   await expect(dialog).toHaveAttribute("aria-busy","true"); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
   await expect(dialog.getByRole("alert")).toContainText("Pengajuan belum dapat diproses");
   await shot(page, `finance-dialog-${width}`);
   await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
   await noOverflow(page);
   await shot(page, `finance-${width}`);

   await page.goto("/supplier/catalog/new"); await expect(page.getByLabel(/Nama Produk/)).toHaveValue("");
   const capacity = await page.getByLabel(/Kapasitas maksimum/).boundingBox(); const unit = await page.getByLabel(/Satuan produk/).boundingBox();
   if (width >= 640) expect(Math.abs(capacity!.y - unit!.y)).toBeLessThan(2);
   await page.getByRole("button", { name: "Lanjut", exact: true }).click(); await expect(page.getByLabel(/Nama Produk/)).toBeFocused(); await noOverflow(page);
   await shot(page, `wizard-${width}`);
   await page.route("**/api/admin/catalog", route => route.fulfill({ status: 500, json: { error: "HTTP 500 Internal Server Error" } }));
   await page.goto("/admin/catalog"); await expect(page.locator("section[role=alert]")).toContainText("Katalog belum dapat dimuat"); await noOverflow(page);
   await shot(page, `admin-${width}`);
   await login(page, "umkm");
   let stale = false;
   await page.route(`**/api/umkm/orders/${orderId}`, route => stale ? route.abort("failed") : route.fulfill({ json: order }));
   await page.goto(`/umkm/pesanan/${orderId}`); await expect(page.getByRole("heading", { name: "Beras Uji Feedback" })).toBeVisible();
   stale = true; await page.getByRole("button", { name: "Muat ulang detail" }).click();
   await expect(page.getByRole("status").filter({ hasText: "Detail terakhir ditampilkan" })).toBeVisible(); await expect(page.getByRole("heading", { name: "Beras Uji Feedback" })).toBeVisible(); await noOverflow(page);
   await expect(page.getByText(/Batas akhir:/)).toContainText("4 Okt 2026");
   await shot(page, `order-${width}`);
   await page.unroute(`**/api/umkm/orders/${orderId}`); await page.context().setOffline(true); await page.getByRole("button",{name:"Muat ulang detail"}).click(); await expect(page.getByRole("heading",{name:"Beras Uji Feedback"})).toBeVisible(); await page.context().setOffline(false);
   await page.goto("/login"); await expect(page.getByRole("heading",{name:"Masuk ke akun Anda"})).toBeVisible(); await noOverflow(page); await shot(page, `login-${width}`);
  });
 }
 test("landing isolation and 200 percent zoom",async ({page})=>{
  await page.setViewportSize({width:1440,height:1000}); await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/"); await page.evaluate(()=>document.fonts.ready); await shot(page,"landing-after");
  await page.goto("/login"); await expect(page.getByRole("heading",{name:"Masuk ke akun Anda"})).toBeVisible(); await page.evaluate(()=>{document.documentElement.style.zoom="2";}); await noOverflow(page); await shot(page,"login-zoom200");
 });

});
