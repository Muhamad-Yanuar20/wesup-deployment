import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { loadEnv } from "vite";
import { Pool } from "pg";

const env = { ...loadEnv("", process.cwd(), ""), ...process.env };
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const batchId = crypto.randomUUID(), registrations = [crypto.randomUUID(), crypto.randomUUID()];
const users: string[] = [];
const sessions: Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>["cookies"][] = [];
let pool: Pool;
test.describe("Supplier pickup camera and account", () => {
  test.use({ reducedMotion: "reduce" });
  test.skip(!env.DATABASE_URL, "Requires disposable live fixture access");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
    for (let index = 0; index < 3; index++) {
      const role = index === 0 ? "supplier" : "umkm", password = "pickup-camera-fixture-42";
      const email = `pickup-camera-${crypto.randomUUID()}@example.com`;
      const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.signUp({ email, password });
      if (data.user) users.push(data.user.id);
      if (error || !data.user || !data.session) throw new Error("Could not create disposable pickup fixture");
      await pool.query("update public.profiles set role=$1,status='active',full_name=$2,phone='081234567890' where id=$3", [role, `Pickup fixture ${index}`, data.user.id]);
      if (index === 0) await pool.query("insert into public.supplier_profiles(user_id,business_name,address,latitude,longitude,ktp_photo_url,nik,verification_status,verified_at) values($1,'Gudang QR QA','Bandung',-6.914744,107.60981,'https://example.com/test.webp',$2,'approved',now())", [data.user.id, `camera-${data.user.id}`]);
      else await pool.query("insert into public.umkm_profiles(user_id,business_name,address,latitude,longitude) values($1,$2,'Bandung',-6.914744,107.60981)", [data.user.id, `UMKM Pickup ${index}`]);
      const jar = new Map<string, string>();
      const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cookies => { for (const cookie of cookies) jar.set(cookie.name, cookie.value); } } });
      const established = await ssr.auth.setSession(data.session);
      if (established.error) throw established.error;
      sessions.push([...jar].map(([name, value]) => ({ name, value, domain: new URL(baseURL).hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const, expires: -1 })));
    }
    await pool.query("insert into public.batches(id,supplier_id,title,description,category,min_quantity,capacity_quantity,unit,status,transaction_policy_version,pickup_name,pickup_address,latitude,longitude,product_photo_url) values($1,$2,'Beras QR QA','Disposable camera test','Beras & Biji-bijian',1,100,'kg','published',1,'Gudang QR','Bandung',-6.914744,107.60981,'/file.svg')", [batchId, users[0]]);
    await pool.query("insert into public.batch_timeline(batch_id,registration_opens_at,registration_closes_at,payment_opens_at,payment_closes_at,estimated_ready_at,pickup_ends_at) values($1,now()-interval '1 hour',now()+interval '1 day',now()+interval '25 hours',now()+interval '49 hours',now()+interval '3 days',now()+interval '3 days 4 hours')", [batchId]);
    await pool.query("insert into public.batch_tiers(batch_id,tier_number,min_volume,max_volume,price_per_unit) values($1,1,1,null,10000)", [batchId]);
    for (let index = 0; index < 2; index++) await pool.query("insert into public.registrations(id,batch_id,umkm_id,quantity,status,final_amount,locked_tier_number,locked_price_per_unit,consented_at,consent_latitude,consent_longitude) values($1,$2,$3,2,'paid',20000,1,10000,now(),-6.914744,107.60981)", [registrations[index], batchId, users[index + 1]]);
    await pool.query("update public.batch_timeline set registration_opens_at=now()-interval '3 days',registration_closes_at=now()-interval '2 days',payment_opens_at=now()-interval '2 days'+interval '1 second',payment_closes_at=now()-interval '1 day',estimated_ready_at=now()-interval '1 hour',pickup_ends_at=now()+interval '3 hours' where batch_id=$1", [batchId]);
    await pool.query("update public.batches set transaction_policy_version=2,status='closed',ready_at=now()-interval '2 hours' where id=$1", [batchId]);
  });
  test.afterAll(async () => {
    try {
      if (pool && users.length) {
        await pool.query("delete from public.escrow_holds where registration_id=any($1::uuid[])", [registrations]);
        await pool.query("delete from public.pickup_events where registration_id=any($1::uuid[])", [registrations]);
        await pool.query("delete from public.pickup_codes where registration_id=any($1::uuid[])", [registrations]);
        await pool.query("delete from public.registrations where batch_id=$1", [batchId]);
        await pool.query("delete from public.batches where id=$1", [batchId]);
        await pool.query("delete from auth.users where id=any($1::uuid[])", [users]);
      }
    } finally { await pool?.end(); }
  });

  test("renders owned account and brand-only footer at all target widths", async ({ page }, info) => {
    await page.context().addCookies(sessions[0]);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto("/supplier/akun");
      await expect(page.getByText("Gudang QR QA", { exact: true })).toBeVisible();
      await expect(page.getByRole("contentinfo").getByRole("link")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`account-${width}.png`), fullPage: true });
    }
  });

  test("preserves the orders-to-pickup return chain including direct access fallback", async ({ page }) => {
    await page.context().addCookies(sessions[0]); await page.goto("/supplier/pesanan");
    await page.getByRole("link", { name: "Pesanan", exact: true }).first().click();
    await expect(page.getByRole("link", { name: /Kembali ke pesanan/ })).toHaveAttribute("href", "/supplier/pesanan");
    await page.goto(`/supplier/batch/${batchId}/pickup?returnTo=${encodeURIComponent(`/supplier/batch/${batchId}/orders?returnTo=%2Fsupplier%2Fpesanan`)}`);
    await page.getByRole("link", { name: "Kembali ke manajemen pesanan" }).click();
    await page.getByRole("link", { name: /Kembali ke pesanan/ }).click(); await expect(page).toHaveURL(/\/supplier\/pesanan$/);
    const ordersFromCatalog = `/supplier/batch/${batchId}/orders?returnTo=%2Fsupplier%2Fcatalog`;
    await page.goto(`/supplier/batch/${batchId}/pickup?returnTo=${encodeURIComponent(ordersFromCatalog)}`);
    await page.getByRole("link", { name: "Manajemen Pesanan", exact: true }).click();
    await expect(page.getByRole("link", { name: "Kembali ke katalog" })).toHaveAttribute("href", "/supplier/catalog");
    await page.goto(`/supplier/batch/${batchId}/pickup`); await expect(page.getByRole("link", { name: /Kembali ke pesanan/ })).toHaveAttribute("href", "/supplier/pesanan");
  });

  test("decodes the actual buyer QR through a virtual video camera and confirms once", async ({ browser }, info) => {
    const buyer = await browser.newContext({ baseURL, reducedMotion: "reduce" }); const supplier = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    try {
      await buyer.addCookies(sessions[1]); await supplier.addCookies(sessions[0]);
      const generated = await Promise.all([buyer.request.post(`/api/pickups/${registrations[0]}/code`), buyer.request.post(`/api/pickups/${registrations[0]}/code`)]);
      expect(generated.map(r => r.status())).toEqual([200, 200]); expect(await generated[0].json()).toEqual(await generated[1].json());
      const ownCode = await generated[0].json();
      expect((await supplier.request.post(`/api/pickups/${registrations[1]}/confirm`, { data: { method: "qr", code: ownCode.qrCodeToken } })).status()).toBe(409);
      const buyerPage = await buyer.newPage(); await buyerPage.goto(`/pesanan/${registrations[0]}/serah-terima`);
      const qr = buyerPage.getByRole("img", { name: "QR pengambilan pesanan" }); await expect(qr).toBeVisible(); const qrData = await qr.getAttribute("src");
      await supplier.addInitScript(({ qrData }) => {
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 768;
          const image = new Image(); image.src = qrData!; await image.decode(); const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingEnabled = false;
          const draw = () => { ctx.fillStyle = "white"; ctx.fillRect(0, 0, 768, 768); ctx.drawImage(image, 64, 64, 640, 640); };
          draw();
          const stream = canvas.captureStream(10);
          const timer = window.setInterval(draw, 60);
          for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { clearInterval(timer); stop(); (window as unknown as { cameraStopped: boolean }).cameraStopped = true; }; }
          return stream;
        } });
      }, { qrData });
      const page = await supplier.newPage(); const response = await page.goto(`/supplier/batch/${batchId}/pickup`);
      expect(response?.headers()["permissions-policy"]).toContain("camera=(self)");
      await page.getByRole("button", { name: "Aktifkan kamera" }).click();
      try { await expect(page.getByRole("combobox")).toHaveValue(registrations[0], { timeout: 20000 }); }
      catch (error) { await page.screenshot({ path: info.outputPath("scanner-failed.png"), fullPage: true }); throw error; }
      expect(await page.evaluate(() => (window as unknown as { cameraStopped: boolean }).cameraStopped)).toBe(true);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const confirm = page.getByRole("button", { name: "Konfirmasi Pengambilan" });
        await confirm.focus(); await expect(confirm).toBeFocused();
        expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`scanner-${width}.png`), fullPage: true });
      }
      let confirms = 0; page.on("request", req => { if (req.url().endsWith("/confirm")) confirms++; });
      await page.getByRole("button", { name: "Konfirmasi Pengambilan" }).dblclick();
      await expect(page.getByText("Serah terima berhasil", { exact: true })).toBeVisible(); expect(confirms).toBe(1);
      const events = await pool.query("select (select count(*) from public.pickup_events where registration_id=$1)::int events,(select count(*) from public.escrow_holds where registration_id=$1)::int escrows", [registrations[0]]);
      expect(events.rows[0]).toEqual({ events: 1, escrows: 1 });
      await buyerPage.reload(); await expect(buyerPage.getByText("Serah terima selesai", { exact: true })).toBeVisible(); await expect(buyerPage.getByRole("img", { name: "QR pengambilan pesanan" })).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath("camera-confirmed.png"), fullPage: true });
      const secondBuyer = await browser.newContext({ baseURL });
      try {
        await secondBuyer.addCookies(sessions[2]); const pin = await (await secondBuyer.request.post(`/api/pickups/${registrations[1]}/code`)).json();
        await page.reload(); await page.getByRole("combobox").selectOption(registrations[1]); await page.getByRole("button", { name: "PIN 4-digit", exact: true }).click();
        await page.getByLabel("PIN 4-digit UMKM").fill(pin.pinCode); await page.getByRole("button", { name: "Konfirmasi Pengambilan" }).click(); await expect(page.getByText("Serah terima berhasil", { exact: true })).toBeVisible();
      } finally { await secondBuyer.close(); }
    } finally { await buyer.close(); await supplier.close(); }
  });
});
