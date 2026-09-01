# Catalog Batch CRUD + Validation — TDD Evidence

Tanggal verifikasi: 2026-08-31
Migrasi: `20260831020000_backend_lifecycle.sql` (Slice 1 subset)

## Scope

Menutup gap PRD 2.1.2/2.1.4/2.1.5: API CRUD batch milik supplier + validasi input
lengkap yang sebelumnya hanya berupa skema tabel, tanpa jalur pembuatan/update dari
supplier.

1. **`create_batch(...)`** (RPC + `POST /api/suppliers/batches`) — validasi:
   - timeline linear `open < close < payment open < payment close < ready`
   - tier volume **strictly increasing** (no-inversion volume)
   - tier volume **non-overlap**
   - tier price **non-increasing** dengan volume (volume discount; harga tidak boleh naik)
   - koordinat terikat **wilayah Bandung**
   - hanya supplier ter-approve (verification `approved`) atau admin
   - insert atomik: `batches` + `batch_tiers` + `batch_timeline` dalam satu fungsi
2. **`update_batch(...)`** (RPC + `PATCH /api/suppliers/batches/[id]`) — tidak bisa
   diubah lokasi/pickup setelah ada registrant (location lock).
3. **`delete_batch(...)`** (RPC + `DELETE`) — hard-delete hanya jika tanpa registrant;
   jika ada registrant diarahkan ke `cancel_batch` (soft-cancel).
4. **`list_own_batches()`** (RPC + `GET`) — dashboard batch milik supplier beserta
   tiers + timeline ter-denormalisasi.
5. **`create_recurring_config(...)`** — PRD 2.1.4; Lazy Evaluation (tidak ada cron).

Keputusan penting: parameter RPC memakai prefix `p_` (mengikuti konvensi `cut_off_batch`).
Gate approval supplier memakai helper baru `is_supplier_approved()` (verification
`approved`), bukan `is_supplier()` (yang hanya cek role) — lebih ketat dan sesuai
kebutuhan "supplier terverifikasi yang boleh menerbitkan batch".

## RED/GREEN Evidence

### Task 1 — unit validator `tests/unit/batch-validators.test.ts`

RED: dua kasus gagal sebelum logika benar:

```text
npx vitest run tests/unit/batch-validators.test.ts
FAIL accepts a valid payload   (menolak tier 10000 -> 9000 karena salah disangka inversi)
FAIL rejects tier price inversion
```

Akar masalah disadari saat debug: semula validasi menolak `price < prevPrice`
(penurunan harga). Ini **salah** — kenaikan volume justru harus menurunkan harga
per unit. Inversi yang benar ditolak adalah harga **naik** seiring volume. Perbaikan
di `lib/catalog/batch-validators.ts`: `if (pricePerUnit > prevPrice && prevPrice > 0)`.

GREEN (9/9):

```text
npx vitest run tests/unit/batch-validators.test.ts
Test Files  1 passed (1)   Tests  9 passed (9)
```

### Task 2 — migrasi + schema contract + types

RED: `tests/migrations/backend-lifecycle.test.ts` (baru) gagal sebelum migrasi
ditulis. Dua asersi awal salah relatif ke implementasi yang benar dan dikoreksi ke
makna sebenarnya: (a) gate approval memakai `is_supplier_approved()` (bukan
`is_supplier()`); (b) regex mahkota prefix `p_` memakai `(?:p_)?`.

Setelah migrasi ditulis, `schema.test.ts` RED karena `audit_action` mendapat nilai
`create_batch`/`update_batch`/`delete_batch` — ditambahkan ke `EXPECTED_ENUMS.audit_action`.
`tsc` RED karena `create_batch` dkk belum ada di `types/database.ts` `Functions` —
ditambahkan.

GREEN:

```text
npx vitest run tests/migrations/backend-lifecycle.test.ts   # 10 passed
npx vitest run tests/migrations/schema.test.ts              # 179 passed
```

## Regression

`tests/unit/api-marketplace-search.test.ts` (13) tetap hijau — tidak terpengaruh.

## Files

Baru: `lib/catalog/batch-validators.ts`, `app/api/suppliers/batches/route.ts`,
`app/api/suppliers/batches/[id]/route.ts`, `tests/unit/batch-validators.test.ts`,
`tests/migrations/backend-lifecycle.test.ts`, migrasi `20260831020000`.
Diedit: `tests/helpers/schema-contract.ts`, `types/database.ts`.
