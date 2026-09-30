# Midtrans Snap dan Escrow — TDD Evidence

## Scope

- Snap Sandbox popup untuk checkout multi-metode UMKM.
- Webhook dan GET Status sebagai sumber kebenaran server.
- Satu escrow internal per pembayaran settled; payout Supplier hanya dari bucket `available`.
- QRIS Core API lama tetap kompatibel melalui `integration_type = core_qris`.

## RED → GREEN

| Area | RED assertion | Implementasi hijau |
|---|---|---|
| Adapter Snap | Endpoint/expiry/item details belum tersedia | `createSnapTransaction()` memakai endpoint Snap Sandbox, Basic Auth, expiry tersisa, item detail nominal terkunci, dan tanpa `enabled_payments`. |
| Charge API | Token aktif tidak direuse dan cutoff lima menit tidak ditolak | Redis lock, sesi aktif `payment_checkout_sessions`, attempt lokal `creating/pending`, dan `PAYMENT_CHECKOUT_CUTOFF`. |
| Reconcile | Status masih dicari dari invoice root | Lookup `payment_attempts.provider_order_id`, 404 provider dianggap pending, finalisasi memakai `apply_midtrans_payment_event`. |
| Webhook | Hanya lookup `payments.midtrans_order_id` dan JSON hash | Lookup attempt Snap, hash deterministik, dedup, validasi nominal/signature, dan RPC atomik bersama reconcile. |
| UI | CTA hanya QRIS dan callback dapat terlihat seperti finalisasi lokal | Snap.js hanya pada halaman bayar; callback hanya memanggil reconcile; QRIS legacy tetap ditampilkan jika attempt lama aktif. |
| Escrow | Provider refund/chargeback tidak membekukan saldo | RPC membekukan escrow dan ledger mengurangi bucket `available` bila hold sudah dirilis. |

## Commands

```text
npx vitest run tests/unit/midtrans-snap.test.ts
npx vitest run tests/unit/api-umkm-payment-snap.test.ts
npx vitest run tests/unit/api-umkm-payment-reconcile-snap.test.ts
npx vitest run tests/unit/api-midtrans-webhook-snap.test.ts
npx vitest run tests/migrations/midtrans-snap-checkout.test.ts tests/migrations/schema.test.ts
npx tsc --noEmit
```

## Live/Sandbox checklist

1. Terapkan `20260917000000_midtrans_snap_checkout.sql` setelah backup migration history.
2. Jalankan `node scripts/check-supplier-transaction-schema.mjs`; guard harus meminta migration, RPC, dan relation Snap baru.
3. Set Payment Notification URL Midtrans Sandbox ke `/api/webhook/midtrans` pada domain publik.
4. Uji kartu/QRIS/VA Sandbox dari halaman `/pesanan/[orderId]/bayar`.
5. Pastikan webhook settlement membuat satu `escrow_holds` `held`, satu ledger `escrow_created`, dan status registration `paid`.
6. Setelah pickup + 24 jam, lazy reconciliation memindahkan escrow ke `available`; payout Supplier tetap manual oleh Admin.

## Security notes

- Server Key tidak pernah dikirim ke client.
- Snap token hanya berada di `payment_checkout_sessions` dan dikembalikan melalui route ownership-checked; payload attempt disanitasi dari token/signature.
- RPC payment-event `SECURITY DEFINER`, `search_path = public`, dan execute hanya untuk `service_role`.
- Tidak ada perubahan pada `prd/`.

## Payment configuration incident — RED → GREEN

- RED: charge, reconcile, dan webhook mengembalikan pesan konfigurasi generik ketika `getAdminClient()` gagal; penyebabnya adalah admin key tidak tersedia di proses Next.js.
- GREEN: `SupabaseAdminConfigurationError` kini dipetakan menjadi `503 PAYMENT_ADMIN_CONFIG_MISSING`; kegagalan inisialisasi lain menjadi `503 PAYMENT_ADMIN_INIT_FAILED`. Semua respons menyertakan `requestId` dan log hanya memuat metadata aman.
- Readiness guard `npm run payments:check` memvalidasi URL Supabase, preferensi `SUPABASE_SECRET_KEY` dengan fallback service-role, key Midtrans, boolean production, akses admin read-only, serta migration/RPC Snap. `NEXT_PUBLIC_SITE_URL` diwajibkan saat `--public` atau production dan tetap boleh kosong untuk localhost.
- UI membawa `code`/`requestId`, menampilkan pesan yang sesuai, dan menyediakan tombol **Coba lagi** tanpa mengubah status pembayaran secara lokal.

Verified on 2026-09-16:

```text
npm run payments:check                  # passed: admin key source secret; Snap schema/read-only access ready
npx vitest run                           # 134 files, 1260 tests passed
npx tsc --noEmit                         # passed
npm run lint                             # passed (pre-existing warnings only)
npm run build                            # passed
runtime webhook probe (unknown order)   # HTTP 200, ignored=true; no config error
```
## Snap popup CSP/loader incident — RED → GREEN

- RED: halaman pembayaran memakai CSP global tanpa `frame-src`/`connect-src` Midtrans dan `next/script` berada di Server Component, sehingga event `onReady`/`onError` tidak dapat diamati dan popup dapat diblokir browser.
- GREEN: CSP kini memiliki opsi `allowMidtrans` yang hanya aktif pada `/pesanan/[orderId]/bayar`, dengan nonce tetap dipertahankan. Snap loader dipindah ke Client Component, meneruskan nonce/client key secara aman, serta memiliki state loading/ready/error dan fallback `Buka checkout langsung`.
- Callback Snap hanya menjalankan reconcile; helper `invokeSnapPay` menangkap runtime error dan tidak mengubah status order di client. Charge response wajib memiliki `snapToken` dan `redirectUrl` sebelum popup dibuka.

Verified on 2026-09-16:

```text
npx vitest run tests/unit/csp.test.ts tests/unit/midtrans-snap-client.test.ts tests/components/MidtransSnapLoader.test.tsx  # 7 tests passed
npm test                                                                                                          # 137 files, 1267 tests passed
npx tsc --noEmit                                                                                                  # passed
npm run lint                                                                                                      # passed (pre-existing warnings only)
npm run build                                                                                                     # passed
runtime CSP payment route                                                                                         # Midtrans frame/connect/script/img/font allowlist present
runtime CSP non-payment route                                                                                    # Midtrans allowlist absent
```
## Payment UI/read-model incident — RED → GREEN

- RED: PostgREST select meminta `payment_attempts` sebagai relasi langsung dari `registrations`, padahal FK berada di `payments`. Query kaya gagal lalu fallback minimal menghilangkan `batch_timeline`/deadline; UI menampilkan `—` dan `00:00:00`. Attempt nested juga tidak terbaca oleh DTO.
- GREEN: Select dipusatkan di `lib/orders/selects.ts` dan memuat `payment:payments(...,payment_attempts(...))`. Mapper memprioritaskan attempt pending/terbaru melalui payment relationship. Detail/list endpoint tidak lagi mengembalikan DTO setengah lengkap saat relasi wajib gagal; error menjadi retryable dengan `ORDER_DETAIL_SCHEMA_NOT_READY`/`ORDERS_READ_FAILED`, `requestId`, dan `Retry-After`.
- GREEN UI: `UmkmPaymentPanel` memakai state `checkout_ready`, `checkout_created`, `method_confirming`, `awaiting_payment`, `reconciling`, `paid`, `retryable_failure`, dan `expired`. `payment_type` hanya ditampilkan setelah respons server/reconcile. Callback Snap tidak memfinalisasi order, polling dibatasi dan berhenti saat tab tersembunyi, dan direct checkout hanya tampil sebagai fallback.
- GREEN countdown: `calculatePaymentCountdown` dan `usePaymentWindowCountdown` menghitung offset dari `serverTime`, menampilkan `--:--:--` saat belum tersedia, warna warning/critical berdasarkan sisa waktu, memakai deadline paling awal antara Payment Window dan expiry attempt, serta memicu reconcile/materialization sekali saat expired.

Verified on 2026-09-16:

```text
npx vitest run tests/unit/payment-ui-state.test.ts tests/unit/payment-countdown.test.ts tests/unit/order-read-model.test.ts tests/unit/order-detail-select.test.ts  # 9 tests passed
npx vitest run tests/components/UmkmPaymentPanel.test.tsx                                                                  # 2 tests passed
npx vitest run --exclude 'tests/live/**'                                                                                     # 135 files, 1011 tests passed
npx tsc --noEmit                                                                                                             # passed
npm run lint                                                                                                                 # passed (11 warnings; no errors)
npm run build                                                                                                                # passed
npm run payments:check                                                                                                      # passed
```

Catatan: full suite dengan live database memiliki satu kegagalan fixture katalog yang tidak terkait perubahan ini (`cancellation-search.integration.test.ts`: batch ekstra `Dada ayam 1Kg`).

## Snap popup navigation/CSP recovery — RED → GREEN

- RED: dari Tab Pesanan, `next/link` melakukan client navigation sehingga dokumen pembayaran mempertahankan CSP halaman orders tanpa `frame-src` Midtrans; `snap.pay()` berjalan tetapi iframe checkout diblokir. Navigasi langsung ke URL pembayaran berhasil.
- GREEN: entry point pembayaran kini memakai native anchor sehingga CSP route pembayaran dimuat sebagai dokumen baru. Loader mendeteksi navigasi SPA yang tidak terduga, melakukan satu reload terjaga per order, menangkap `securitypolicyviolation` Midtrans, dan menyediakan fallback checkout langsung bila blokir tetap terjadi.
- State `blocked` tidak pernah mengubah status pembayaran. Callback browser tetap hanya memicu reconcile; status lunas tetap berasal dari webhook/GET Status server.

Verified on 2026-09-16:

```text
npx vitest run tests/unit/payment-navigation-recovery.test.ts tests/unit/payment-ui-blocked.test.ts tests/components/MidtransSnapLoaderRecovery.test.tsx tests/components/PaymentPageLink.test.tsx tests/components/MidtransSnapLoaderPersistentBlock.test.tsx  # 7 tests passed
npm test                                                                                                                        # 150 files, 1290 tests passed
npx tsc --noEmit                                                                                                                # passed
npm run lint                                                                                                                    # passed (11 pre-existing warnings; no errors)
npm run build                                                                                                                   # passed
npm run payments:check                                                                                                          # passed
runtime CSP smoke                                                                                                               # payment route has Midtrans frame allowlist; /umkm/pesanan does not
```