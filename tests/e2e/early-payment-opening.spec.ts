import { test, expect, request, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { Pool } from "pg";
import { mkdir } from "node:fs/promises";

const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
const configured = Boolean(env.DATABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const batchId = "22222222-2222-4222-8222-222222222222", orderId = "11111111-1111-4111-8111-111111111111", proposalId = "33333333-3333-4333-8333-333333333333";
const early = { minimumQuantity: 40, originalMinimumQuantity: null, registeredQuantity: 45, participants: 2, accepted: 2, rejected: 0, hasParticipantHistory: true, canConfigure: false, canPropose: true, canOpen: true, canDecide: false, reason: null, tierNumber: 2, unitPrice: 8000, proposal: { id: proposalId, revision: 2, minimumQuantity: 40, status: "pending", decision: null } };
const offerContext = { policyVersion: 2, paymentOpeningPolicy: "fixed_cutoff", commercialLocked: true, capacityQuantity: 100, unit: "kg", paymentOpensAt: "2026-10-03T00:00:00Z", paymentClosesAt: "2026-10-04T00:00:00Z", pickupStartsAt: "2026-10-05T01:00:00Z", pickupEndsAt: "2026-10-05T09:00:00Z", readyAt: null, replacements: [] };
const buyerOrder = { id: orderId, batchId, batchTitle: "Beras Uji Pembayaran Awal", batchDisplayCode: "BATCH-UJI", supplierName: "Gudang Uji", batchStatus: "published", quantity: 20, unit: "kg", status: "registered", policyVersion: 2, phase: "waiting_payment_window", presentation: { phase: "waiting_payment_window", label: "Pengumpulan pesanan", explanation: "Harga belum final. Pembayaran belum dibuka.", deadlineAt: "2026-10-03T00:00:00Z", group: "ongoing", primaryAction: { label: "Lihat pesanan", href: `/umkm/pesanan/${orderId}` } }, finalAmount: null, lockedTier: null, timeline: { registrationClosesAt: "2026-10-03T00:00:00Z", paymentOpensAt: offerContext.paymentOpensAt, paymentClosesAt: offerContext.paymentClosesAt, estimatedReadyAt: offerContext.pickupStartsAt, pickupDeadlineAt: offerContext.pickupEndsAt, complaintDeadlineAt: null }, capabilities: { canWithdraw: true, canPay: false, canViewPickup: false, canComplain: false, canTrackDispute: false, canRate: false, canSubmitRefundAccount: false }, invoice: null, pickup: null, escrow: null, dispute: null, rating: null, refund: null, paymentAttempt: null, serverTime: "2026-10-01T00:00:00Z" };
const accounts: Record<string, { id: string; email: string }> = {};
const sessions: Record<string, Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>> = {};
let pool: Pool;
async function login(page: Page, role: string) { await page.context().clearCookies(); await page.context().addCookies(sessions[role].cookies); }
async function capture(page: Page, name: string, width: number) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `docs/testing/early-payment/${name}-${width}.png`, fullPage: true, animations: "disabled" }); }
test.describe("early payment UI with isolated transaction responses", () => {
  test.skip(!configured, "Requires disposable auth fixture access; transaction endpoints are intercepted");
  test.beforeAll(async () => {
    await mkdir("docs/testing/early-payment", { recursive: true });
    pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
    for (const role of ["supplier", "umkm"]) {
      const email = `early-ui-${crypto.randomUUID()}@example.com`, password = "early-ui-fixture-password-42";
      const auth = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await auth.auth.signUp({ email, password });
      if (data.user) accounts[role] = { id: data.user.id, email };
      if (error || !data.session || !data.user) throw new Error("Disposable UI fixture unavailable");
      await pool.query("update public.profiles set role=$1,status='active' where id=$2", [role, data.user.id]);
      if (role === "supplier") await pool.query("insert into public.supplier_profiles(user_id,business_name,address,latitude,longitude,ktp_photo_url,nik,verification_status) values($1,'Gudang Uji','Bandung',-6.914744,107.60981,'https://example.com/test.webp',$2,'approved')", [data.user.id, `early-${data.user.id}`]);
      const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100" });
      const response = await api.post("/api/auth/login", { data: { email, password, role } });
      expect(response.status()).toBe(200); sessions[role] = await api.storageState(); await api.dispose();
    }
  });
  test.afterAll(async () => { try { for (const account of Object.values(accounts)) await pool?.query("delete from auth.users where id=$1", [account.id]); } finally { await pool?.end(); } });
  for (const width of [1440, 390]) {
    test(`target, supplier confirmation and participant decision at ${width}px`, async ({ page }) => {
      test.setTimeout(90000); await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: "reduce" });
      await login(page, "supplier"); await page.goto("/supplier/catalog/new");
      const target = page.getByLabel(/Target minimum untuk membuka pembayaran/);
      await expect(target).toHaveValue("100"); await page.getByLabel(/Kapasitas maksimum/).fill("80"); await expect(target).toHaveValue("80");
      await target.fill("40"); await page.getByLabel(/Kapasitas maksimum/).fill("90"); await expect(target).toHaveValue("40");
      await capture(page, "wizard", width);
      await target.evaluate(el => el.scrollIntoView({ block: "center" }));
      await page.screenshot({ path: `docs/testing/early-payment/wizard-target-${width}.png`, animations: "disabled" });
      let volume = 45, closed = false, attempt = 0, transactionReads = 0, productReads = 0;
      await page.route(`**/api/suppliers/batches/${batchId}`, async route => {productReads++;await route.fulfill({status:503,json:{error:"Detail sementara belum dapat dimuat."}});});
      const confirmations: Array<Record<string, unknown>> = [];
      await page.route(`**/api/suppliers/batches/${batchId}/transactions`, async route => {
        transactionReads++;
        await new Promise(resolve => setTimeout(resolve, 350));
        await route.fulfill({ json: { item: { batch: { id: batchId, title: "Beras Uji Pembayaran Awal", status: closed ? "closed" : "published", min_quantity: 25, unit: "kg" }, summary: { registered: 2, pendingPayment: 0, paid: 0, pickedUp: 0, failed: 0, refund: 0, totalQuantity: volume }, orders: [{ registrationId: orderId, umkmName: "Usaha Uji A", quantity: 20, status: "registered", finalAmount: null }, { registrationId: "44444444-4444-4444-8444-444444444444", umkmName: "Usaha Uji B", quantity: volume - 20, status: "registered", finalAmount: null }], capacityQuantity: 100, paymentWindowHours: 24, capabilities: { canCloseBatch: !closed }, offerContext: { ...offerContext, earlyPayment: { ...early, registeredQuantity: volume, canOpen: !closed } }, serverTime: "2026-10-01T00:00:00Z" } } });
      });
      await page.route(`**/api/suppliers/batches/${batchId}/close`, async route => {
        attempt++; confirmations.push(route.request().postDataJSON().confirmation);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (attempt === 1) { volume = 46; await route.fulfill({ status: 409, json: { error: "Jumlah berubah. Muat ulang transaksi dan periksa ringkasan terbaru." } }); }
        else { closed = true; await route.fulfill({ json: { ok: true, item: { closed: true } } }); }
      });
      await page.goto(`/supplier/batch/${batchId}`);
      const opener = page.getByRole("button", { name: "Buka pembayaran sekarang", exact: true }); await expect(opener).toBeEnabled();
      expect(transactionReads).toBe(1);expect(productReads).toBe(0);
      await capture(page, "supplier", width); await opener.click(); const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveAccessibleDescription(/45 kg.*8.000.*24 jam/);
      await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab"); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
      await dialog.getByRole("button", { name: "Ya, lanjutkan" }).click(); await expect(dialog).toHaveAttribute("aria-busy", "true");
      await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("alert")).toContainText("Jumlah berubah"); await capture(page, "supplier-dialog", width);
      await dialog.getByRole("button", { name: "Muat ulang transaksi" }).click(); await expect(dialog).not.toBeVisible();
      await expect(page.getByText(/Terkumpul 46 kg/)).toBeVisible(); await opener.click();
      await dialog.getByRole("button", { name: "Ya, lanjutkan" }).click(); await expect(page.getByText("Pembayaran dibuka. Tagihan sudah diterbitkan.")).toBeVisible();
      expect(confirmations.map(value => value.registeredQuantity)).toEqual([45, 46]);
      await login(page, "umkm"); let agreed = false, decisionAttempts = 0;
      await page.route(`**/api/umkm/orders/${orderId}`, route => route.fulfill({ json: { ...buyerOrder, earlyPayment: { ...early, canOpen: false, canDecide: !agreed, proposal: { ...early.proposal, decision: agreed ? "accepted" : null } } } }));
      await page.route(`**/api/umkm/orders/${orderId}/early-payment-decision`, async route => {
        decisionAttempts++; await new Promise(resolve => setTimeout(resolve, 350));
        if (decisionAttempts === 1) { agreed = true; await route.abort("failed"); } else await route.fulfill({ json: { item: {} } });
      });
      await page.goto(`/umkm/pesanan/${orderId}`); await expect(page.getByText("Usulan pembayaran lebih awal", { exact: true })).toBeVisible();
      await capture(page, "buyer", width); await page.getByRole("button", { name: "Setuju pembukaan lebih awal", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Ya, setuju" }).click();
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText("belum terkonfirmasi"); await capture(page, "buyer-dialog", width);
      await page.getByRole("dialog").getByRole("button", { name: "Muat ulang keputusan" }).click();
      await expect(page.getByText(/Anda sudah menyetujui usulan/)).toBeVisible(); expect(decisionAttempts).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
});
