# TDD Evidence Report — Bank RLS Refinement, Transaction Log, Server Timestamp Billing

## Source plan
Tiga fitur dari task list:
1. **Refine Bank Account RLS (Disbursement Setup)** — hanya pemilik rekening yang dapat SELECT datanya sendiri; seluruh penulisan tetap lewat SECURITY DEFINER RPC.
2. **Transaction Log Table** — struktur tabel Supabase untuk memantau transisi status order (`Pending -> Paid -> Refund/Escrow`) dan merekam data payment gateway.
3. **Frontend API Support** — Server Timestamp absolut di seluruh billing payload agar countdown frontend tidak bergantung jam browser.

Audit awal menemukan: `umkm_bank_accounts` masih memakai policy `FOR ALL` (`umkm_bank_accounts_own_all`, migrasi 0001) sehingga UMKM dapat menulis langsung lewat REST dan melewati validasi `attach_refund_bank_account`; `supplier_bank_accounts` sudah SELECT-only sejak migrasi `20260915100000` namun belum membatasi supplier non-approved; belum ada tabel log transisi status pembayaran (hanya `registration_status_events` untuk status registrasi dan `payment_webhook_logs` yang admin-only); `serverTime` sudah ada di seluruh endpoint billing live (`charge`, `reconcile`, list/detail pesanan, progress, orders supplier) tetapi field mock-era `PaymentInvoice.serverTimestamp` tidak konsisten dengan konvensi `serverTime`.

## Keputusan desain (disetujui user)
- Supplier bank account SELECT dibatasi `is_approved_supplier()`; UMKM bank account SELECT owner-only; tanpa policy INSERT/UPDATE/DELETE untuk user (tulisan RPC-only).
- Transaction log ditulis **eksplisit** (bukan trigger `payments.status`) dari `apply_midtrans_payment_event`, jalur legacy webhook, dan jalur legacy reconcile — konsisten dengan aturan Lazy Evaluation.
- Log transaksi bersifat **additif** terhadap `payment_webhook_logs` (tetap menjadi raw store + dedup), dengan SELECT role-aware (umkm/supplier own, admin ALL).
- Field mock-era `serverTimestamp` diganti `serverTime` agar konsisten dengan read model live.

## Task report

### Task: migrasi `20260918000000_bank_account_rls.sql`
- **Ringkasan:** drop `umkm_bank_accounts_own_all` (FOR ALL) lalu buat `umkm_bank_accounts_owner_select` (SELECT, owner) — admin select dipertahankan; recreate `supplier_bank_accounts_supplier_select` dengan gate `(supplier_id = auth.uid() and public.is_approved_supplier()) or public.is_admin()`.
- **File produksi:** `supabase/migrations/20260918000000_bank_account_rls.sql`
- **File test:** `tests/migrations/bank-account-rls.test.ts`, tambahan pada `tests/live/auth-rls.integration.test.ts`
- **Validation command:** `npx vitest run tests/migrations/bank-account-rls.test.ts tests/live/auth-rls.integration.test.ts`

**GREEN — setelah migrasi dibuat + diaplikasikan ke DB live:**
```
Test Files  2 passed (2)
     Tests  17 passed (17)
```

**Catatan live test:** PATCH yang difilter RLS tetap membalas 204 (zero-row no-op) — asersi diubah dari "HTTP >= 400" menjadi "nilai tersimpan tidak berubah / 0 baris terlihat", yang merupakan asersi keamanan yang benar untuk PostgREST.

### Task: migrasi `20260918010000_transaction_log.sql`
- **Ringkasan:** tabel `public.transaction_logs` (registration_id, payment_id, payment_attempt_id, event_type `payment_status_change|gateway_event`, from/to_status `payment_status`, provider_status, gateway_transaction_id, payload jsonb, source `webhook|reconcile|system|manual`, actor_id, created_at) + RLS role-aware + SECURITY DEFINER `record_transaction_log` (revoke public/anon/authenticated, grant service_role) + re-definisi `apply_midtrans_payment_event` yang kini mencatat setiap outcome (settlement/capture -> paid, refund/chargeback -> refunded, expire/deny/cancel -> gateway_event).
- **File produksi:** `supabase/migrations/20260918010000_transaction_log.sql`, `app/api/webhook/midtrans/route.ts`, `app/api/umkm/orders/[orderId]/payment/reconcile/route.ts`
- **File test:** `tests/migrations/transaction-log.test.ts`, tambahan pada `tests/unit/api-midtrans-webhook-snap.test.ts`, `tests/unit/api-umkm-payment-reconcile-snap.test.ts`, entri `tests/helpers/schema-contract.ts` (tabel, indeks, fungsi)
- **Validation command:** `npx vitest run tests/migrations/transaction-log.test.ts tests/unit/api-midtrans-webhook-snap.test.ts tests/unit/api-umkm-payment-reconcile-snap.test.ts tests/migrations/schema.test.ts`

**GREEN:**
```
tests/migrations/transaction-log.test.ts (5 tests)
tests/unit/api-midtrans-webhook-snap.test.ts (6 tests)
tests/unit/api-umkm-payment-reconcile-snap.test.ts (5 tests)
```

Jalur yang mencatat log: webhook Snap (`apply_midtrans_payment_event`, log internal RPC), webhook legacy tanpa attempt (`finalize_payment` + `record_transaction_log`), webhook legacy expire/deny/cancel, reconcile legacy settle (`finalize_payment` + `record_transaction_log`, source `reconcile`), reconcile legacy expire tanpa attempt. Panggilan log bersifat best-effort (hasil rpc diabaikan) agar finalisasi pembayaran tidak gagal karenanya.

### Task: konsistensi Server Timestamp billing payload
- **Ringkasan:** rename `PaymentInvoice.serverTimestamp` -> `serverTime` (`lib/payments/types.ts`, 4 fixtures `lib/payments/mock-data.ts`, konsumen `components/payments/PaymentWindowClient.tsx`); `serverTime` ditambahkan eksplisit ke schema OpenAPI `Order` (mencakup list/detail/supplier orders); asersi OpenAPI + payload charge.
- **File produksi:** `lib/payments/types.ts`, `lib/payments/mock-data.ts`, `components/payments/PaymentWindowClient.tsx`, `lib/openapi/schemas.ts`
- **File test:** `tests/unit/openapi-document.test.ts` (kasus baru "documents an absolute serverTime in every billing/countdown payload"), `tests/unit/api-umkm-payment-snap.test.ts` (payload charge wajib memuat `serverTime` valid + `attempt.expiresAt`)
- **Validation command:** `npx vitest run tests/unit/openapi-document.test.ts tests/unit/api-umkm-payment-snap.test.ts tests/components/PaymentWindowClient.test.tsx`

**GREEN:**
```
tests/unit/openapi-document.test.ts (3 tests)
tests/unit/api-umkm-payment-snap.test.ts (5 tests)
tests/components/PaymentWindowClient.test.tsx (4 tests)
```

## Deployment
Migrasi diaplikasikan ke database Supabase live (dev) via `pg` dalam transaksi, dan tercatat di `supabase_migrations.schema_migrations`:
```
20260918010000 transaction_log
20260918000000 bank_account_rls
```
Verifikasi post-apply: policy `umkm_bank_accounts` kini hanya SELECT (owner/admin), `supplier_bank_accounts` SELECT dengan gate approval, `transaction_logs` + `record_transaction_log` tersedia.

## Full validation
```
npm test  -> Test Files 154 passed | 1 skipped (155); Tests 1332 passed | 3 skipped
eslint .  -> 0 errors (11 warning pre-existing, file lama)
next build-> exit 0
```

## Risiko & catatan
- `apply_midtrans_payment_event` di-re-define utuh di migrasi baru; isi logika bisnis dipertahankan persis, hanya ditambah pemanggilan `record_transaction_log` sebelum tiap `return` bercabang. Logika duplikasi (`duplicate: true`) sengaja tidak dicatat.
- `record_transaction_log` men-cast text -> `payment_status` secara eksplisit; nilai provider yang tidak valid akan gagal cepat.
- `npm run lint` gagal di lingkungan WSL1 karena wrapper (`WSL 1 is not supported`); lint dijalankan langsung via `node node_modules/eslint/bin/eslint.js` dengan hasil 0 error.
- Pekerjaan WIP marketplace/supplier-batch milik sesi sebelumnya tetap aman di `git stash` (`stash@{0}: On main: unstaged marketplace/supplier-batch changes`) dan tidak disentuh perubahan ini.
