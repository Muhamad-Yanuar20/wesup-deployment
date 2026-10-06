import {test,expect,request} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {loadEnv} from "vite";
import {Pool} from "pg";
import {mkdir} from "node:fs/promises";
const env={...loadEnv("",process.cwd(),""),...process.env};
const orderId="11111111-1111-4111-8111-111111111111";
let db:Pool,userId:string,cookies:Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>;
test.describe("payment continuation with disposable buyer and intercepted checkout",()=>{
 test.skip(!env.DATABASE_URL||!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,"Requires disposable auth fixture");
 test.beforeAll(async()=>{
  await mkdir("docs/testing/payment-continuation",{recursive:true});
  await mkdir("docs/testing/order-status-integrity",{recursive:true});
  db=new Pool({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:1});
  const email=`payment-ui-${crypto.randomUUID()}@example.com`,password="payment-ui-fixture-password-42";
  const auth=createClient(env.NEXT_PUBLIC_SUPABASE_URL!,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.signUp({email,password});
  if(data.user)userId=data.user.id;
  if(error||!data.user||!data.session)throw new Error("Disposable buyer fixture unavailable");
  await db.query("update profiles set role='umkm',status='active' where id=$1",[userId]);
  const api=await request.newContext({baseURL:process.env.PLAYWRIGHT_BASE_URL??"http://localhost:3100"});
  try{const response=await api.post("/api/auth/login",{data:{email,password,role:"umkm"}});expect(response.status()).toBe(200);cookies=await api.storageState();}finally{await api.dispose();}
 });
 test.afterAll(async()=>{try{if(userId)await db?.query("delete from auth.users where id=$1",[userId]);}finally{await db?.end();}});
 for(const width of [1440,390])test(`expired checkout remains payable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.context().addCookies(cookies.cookies);
  const now=new Date().toISOString(),opens=new Date(Date.now()-3600000).toISOString(),closes=new Date(Date.now()+3600000).toISOString();
  let charges=0;
  const item={id:orderId,batchId:"22222222-2222-4222-8222-222222222222",batchTitle:"Sayur Uji Kelanjutan",batchDisplayCode:"BATCH-UJI",supplierName:"Gudang Uji",batchStatus:"closed",quantity:111,unit:"kg",status:"pending_payment",phase:"payment_open",policyVersion:2,finalAmount:7770000,lockedUnitPrice:70000,lockedTier:3,serverTime:now,createdAt:now,presentation:{phase:"payment_open",label:"Pembayaran belum berhasil",explanation:"Percobaan sebelumnya kedaluwarsa. Waktu bayar masih tersedia.",group:"needs_action",deadlineAt:closes,primaryAction:{label:"Coba bayar lagi",href:`/umkm/pesanan/${orderId}`}},timeline:{registrationClosesAt:opens,paymentOpensAt:opens,paymentClosesAt:closes,estimatedReadyAt:closes,pickupDeadlineAt:null,complaintDeadlineAt:null},capabilities:{canPay:true},invoice:{id:"invoice",grossAmount:7770000,status:"pending",paidAt:null},paymentAttempt:{id:"old",status:"expired",providerStatus:"expire",paymentMethod:null,checkoutMode:"snap",expiresAt:opens},paymentProgress:{state:"failed",canOpenCheckout:true,canCheckStatus:true,lastCheckedAt:null,blockedReason:null},pickup:null,escrow:null,dispute:null,refund:null,rating:null};
  await page.addInitScript(()=>{window.snap={pay:(_token,callbacks)=>{document.body.dataset.snapOpened="true";setTimeout(()=>callbacks?.onSuccess?.(),100);}};});
  await page.route("**/snap/snap.js",route=>route.fulfill({contentType:"application/javascript",body:"/* fixture Snap already installed */"}));
  await page.route(`**/api/umkm/orders/${orderId}**`,async route=>{
   const url=route.request().url();
   if(url.endsWith("/charge")){charges++;item.paymentAttempt={...item.paymentAttempt,id:"new",status:"pending",providerStatus:"pending",expiresAt:closes};item.paymentProgress.state="checkout_created";item.presentation.label="Harga final - waktunya bayar";await new Promise(resolve=>setTimeout(resolve,500));await route.fulfill({json:{attempt:{...item.paymentAttempt,id:"new",status:"pending",providerStatus:"pending",expiresAt:closes,snapToken:"fixture-token",redirectUrl:"https://app.sandbox.midtrans.com/fixture"},paymentProgress:{...item.paymentProgress,state:"checkout_created"},serverTime:now}});return;}
   if(url.endsWith("/reconcile")){await route.fulfill({json:{localStatus:"pending_payment",status:"pending",attemptStatus:"pending",paymentType:null,paymentProgress:{...item.paymentProgress,state:"checkout_created"},serverTime:now}});return;}
   await route.fulfill({json:{item:undefined,...item}});
  });
  await page.goto(`/umkm/pesanan/${orderId}`);
  const pay=page.getByRole("button",{name:"Coba bayar lagi",exact:true});await expect(pay).toBeEnabled({timeout:20000});
  await pay.click();await expect(page.getByRole("button",{name:"Memproses…",exact:true})).toBeDisabled();
  await expect(page.locator("body")).toHaveAttribute("data-snap-opened","true");expect(charges).toBe(1);
  await expect(page.getByText("Pembayaran terkonfirmasi",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Waktu pembayaran berakhir",{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`docs/testing/payment-continuation/retry-${width}.png`,fullPage:true,animations:"disabled"});
 });
 for(const width of [1440,390])test(`inconsistent cancellation requires inspection at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.context().addCookies(cookies.cookies);
  const now=new Date().toISOString(),opens=new Date(Date.now()-3600000).toISOString(),closes=new Date(Date.now()+3600000).toISOString();
  let reads=0,charges=0;
  await page.route(`**/api/umkm/orders/${orderId}**`,async route=>{
   if(route.request().url().endsWith('/charge')){charges++;await route.fulfill({status:409,json:{error:'Status pesanan perlu diperiksa'}});return;}
   reads++;await new Promise(resolve=>setTimeout(resolve,400));
   const restored=reads>1;
   await route.fulfill({json:{id:orderId,batchId:'22222222-2222-4222-8222-222222222222',batchTitle:'Uji integritas pesanan',batchDisplayCode:'BATCH-UJI',supplierName:'Gudang Uji',batchStatus:'closed',quantity:25,unit:'gram',status:restored?'paid':'cancelled',phase:restored?'paid_waiting_ready':'cancelled',policyVersion:2,finalAmount:337500,lockedUnitPrice:13500,lockedTier:2,serverTime:now,createdAt:now,presentation:{phase:restored?'paid_waiting_ready':'cancelled',label:restored?'Barang sedang disiapkan':'Pesanan dibatalkan',explanation:'Ikuti status yang telah diverifikasi server.',group:'needs_action',primaryAction:{label:'Lihat detail',href:`/umkm/pesanan/${orderId}`}},timeline:{registrationClosesAt:opens,paymentOpensAt:opens,paymentClosesAt:closes,estimatedReadyAt:closes,pickupDeadlineAt:closes,complaintDeadlineAt:null},capabilities:{canPay:false},invoice:{id:'invoice',grossAmount:337500,status:'paid',paidAt:now},paymentAttempt:null,paymentProgress:restored?{state:'paid',canOpenCheckout:false,canCheckStatus:false,lastCheckedAt:now,blockedReason:null}:{state:'status_unknown',canOpenCheckout:false,canCheckStatus:false,lastCheckedAt:null,blockedCode:'ORDER_STATUS_INCONSISTENT',integrityIssue:'cancelled_with_paid_invoice',blockedReason:'Status pesanan perlu diperiksa. Muat ulang detail atau hubungi bantuan transaksi sebelum membayar.'},pickup:null,escrow:null,dispute:null,refund:null,rating:null}});
  });
  await page.goto(`/umkm/pesanan/${orderId}`);
  await expect(page.getByRole('status').filter({hasText:'Status pesanan perlu diperiksa'})).toBeVisible({timeout:20000});
  await expect(page.getByRole('button',{name:'Bayar sekarang',exact:true})).toHaveCount(0);
  await page.screenshot({path:`docs/testing/order-status-integrity/inspection-${width}.png`,fullPage:true,animations:'disabled'});
  const reload=page.locator('#pembayaran').getByRole('button',{name:'Muat ulang detail'});
  await reload.focus();await reload.press('Enter');
  await expect(page.getByText('Pembayaran terkonfirmasi',{exact:true})).toBeVisible();
  expect(charges).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`docs/testing/order-status-integrity/recovered-${width}.png`,fullPage:true,animations:'disabled'});
 });
});
