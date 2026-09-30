# TDD Evidence Report — Supplier Transactions

**Task:** Menghubungkan lifecycle batch Supplier dengan reservasi kapasitas, penguncian tier, invoice UMKM, QRIS Midtrans Sandbox, fulfillment, ledger escrow, dan payout manual.

## RED → GREEN evidence

| Area | Test-first contract | GREEN command/result |
|---|---|---|
| Batch lifecycle | `tests/unit/supplier-batch-lifecycle.test.ts` menguji capacity close, cutoff timestamp, manual-close minimum, Tier 1 fallback, dan payment-window allowlist. | `npx vitest run tests/unit/supplier-batch-lifecycle.test.ts` — 6 passed |
| Capacity reservation | `tests/unit/registration-counter.test.ts` menguji Lua check-and-increment, kapasitas tak terbatas, dan remaining quantity pada `BATCH_CAPACITY_EXCEEDED`. | `npx vitest run tests/unit/registration-counter.test.ts` — passed |
| Supplier schema/RLS | `tests/migrations/supplier-batch-transactions.test.ts` mengunci migrasi aditif, event/ledger/payout, RPC, dan revokasi policy direct-write. | `npx vitest run tests/migrations/supplier-batch-transactions.test.ts` — 4 passed |
| Supplier API | `tests/unit/api-supplier-transactions.test.ts` menguji ownership/404, lazy materialization, close RPC envelope, fail-fast `PGRST202`, Supabase RPC binding, retryable schema errors, dan safe logging. | `npx vitest run tests/unit/api-supplier-transactions.test.ts` — 10 passed |
| Migration history | `tests/migrations/migration-history-reconciliation.test.ts` memastikan dua versi remote `20260914*` direpresentasikan sebagai marker no-op tanpa replay DDL. | `npx vitest run tests/migrations/migration-history-reconciliation.test.ts` — 2 passed |
| Deployment guard | `tests/unit/supplier-schema-guard.test.ts` menguji missing-object detection dan memastikan metadata PostgreSQL dibaca sequential melalui satu client. | `npx vitest run tests/unit/supplier-schema-guard.test.ts` — 3 passed |
| Midtrans adapter | `tests/unit/midtrans.test.ts` menguji sandbox URL, QR action, custom expiry, dan expire request tanpa membocorkan server key. | `npx vitest run tests/unit/midtrans.test.ts` — 2 passed |
| UMKM regression | Suite existing tetap menguji charge/reconcile/webhook, pickup, complaint, rating, refund account, dan read model. | `npm test` — 123 test files passed, 1 skipped; 1,224 tests passed, 3 skipped |

## Full verification

`npm run lint` dan `npm run build` adalah release gate. Live Supabase/read-model smoke test dijalankan setelah migration `20260915000000_umkm_orders_lifecycle.sql`, `20260915100000_supplier_batch_transactions.sql`, dan `20260916000000_fix_supplier_invoice_upsert.sql` diterapkan; Midtrans Sandbox webhook settlement/expire tetap menjadi follow-up integration test.

## Incident — pusat transaksi belum dapat dimuat

- Root cause terkonfirmasi pada `2026-09-15`: remote schema berhenti di `20260914010000`, sehingga PostgREST mengembalikan `PGRST202` untuk `materialize_supplier_batch` dan `get_supplier_batch_transaction`.
- Endpoint kini fail-fast saat materialisasi gagal, mempertahankan binding `client.rpc`, memetakan schema error menjadi `503 SUPPLIER_SCHEMA_NOT_READY` dengan `Retry-After: 30`, dan hanya mencatat `requestId` serta error code.
- `scripts/check-supplier-transaction-schema.mjs` menjadi pre-deploy guard read-only. Setelah deployment, guard mengembalikan `Supplier transaction schema is ready through migration 20260916000000.` dan memeriksa definisi RPC UPSERT.
- Dry-run Supabase sudah diverifikasi dan hanya mencantumkan migration yang belum diterapkan; setelah perbaikan terakhir dry-run mengembalikan `Remote database is up to date.`

### Deployment selesai (2026-09-15)

- Backup migration history dan snapshot metadata schema dibuat di direktori temporary host; dump schema penuh tidak tersedia karena Supabase CLI memerlukan Docker yang tidak aktif.
- Marker `20260914000000` dan `20260914010000` ditambahkan sebagai no-op agar history remote yang tidak memiliki nama/statement tetap terlacak tanpa menghapus atau menandai migration sebagai reverted.
- `supabase db push --db-url ... --skip-vault` berhasil menerapkan migration lifecycle secara berurutan, lalu migration perbaikan invoice; history remote kini sinkron sampai `20260916000000`.
- PostgREST schema cache di-reload dan deployment guard lulus.
- Live database integration: 232 passed. RPC smoke test `get_supplier_batch_transaction` untuk Supplier valid mengembalikan batch, summary, capabilities, dan `serverTime`.
- Full regression setelah deployment: `npm test` 126 file passed (1 skipped), 1.230 passed (3 skipped); `npx tsc --noEmit`, lint (0 error), dan production build lulus.
- Browser UI smoke test tidak dijalankan karena sesi browser automation reset; verifikasi read-model/RPC dan test suite tetap lulus.

## Incident follow-up — invoice UPSERT dan recovery (2026-09-15/16)

- Setelah migration lifecycle aktif, materialisasi batch yang cutoff-nya telah lewat memanggil `close_batch_and_issue_invoices` dan gagal dengan PostgreSQL `42702` karena referensi `status` pada `payments` UPSERT ambigu.
- Migration aditif `20260916000000_fix_supplier_invoice_upsert.sql` mempertahankan signature, security, grant, dan perilaku RPC; referensi status kini dikualifikasi sebagai `existing.status`, sehingga payment `paid` tidak pernah didowngrade.
- Deployment guard dinaikkan sampai `20260916000000` dan memeriksa definisi fungsi aktif untuk alias UPSERT. Dry-run hanya mencantumkan migration perbaikan tersebut; migration berhasil diterapkan dan PostgREST schema cache di-reload.
- Recovery dry-run kemudian `--apply` dijalankan secara transaksional untuk batch `984c63e0-3e3b-4bfc-bd2c-122f9bf59215`. Anchor waktu database: `2026-09-15T18:28:04.066Z`; deadline: `2026-09-16T18:28:04.066Z` (tepat 24 jam).
- Hasil recovery: final tier 3, harga terkunci Rp35.000/unit, total 100 unit, invoice 80 unit Rp2.800.000 dan 20 unit Rp700.000, kedua registration `pending_payment`, dua payment `pending`, satu status event recovery, dua notifikasi deadline, dan `strike_count` tidak berubah.
- Batch kosong `7b2887f1-9a27-4af6-90d6-43591cefecf8` dimaterialisasi lazily menjadi `closed` dengan `close_reason = no_registrations`, tanpa invoice; snapshot mengembalikan `orders: []` untuk empty state.
- Recovery kedua bersifat no-op (`already_recovered` untuk batch berorder); tidak memperpanjang deadline atau menduplikasi invoice/event/notifikasi.
- Live snapshot dengan klaim Supplier valid mengembalikan `batch`, `summary`, `orders`, `capabilities`, dan `serverTime` untuk kedua batch.

## Deployment follow-up

- Pastikan `MIDTRANS_IS_PRODUCTION=false` (bukan nilai lain seperti `faalse`).
- `MIDTRANS_SERVER_KEY` hanya di environment server; `MIDTRANS_CLIENT_KEY` tidak dibutuhkan oleh Core API QRIS.
- Set `MIDTRANS_MERCHANT_ID` bila ingin webhook menolak merchant id yang tidak cocok; validasi ini bersifat optional agar Sandbox lama tetap kompatibel.
- Daftarkan URL webhook Sandbox ke `/api/webhook/midtrans` dan uji settlement/expire/out-of-order.
- Payout Supplier dan refund UMKM masih berupa ledger, antrean, rekening, dan bukti transfer manual; tidak ada disbursement API.
