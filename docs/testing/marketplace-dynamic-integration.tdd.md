# Dynamic Marketplace Integration — TDD Evidence

Tanggal verifikasi: 2026-09-08

## Tahap 3 — Listing dari read model Supabase

### RED

Kontrak baru pada `tests/unit/api-marketplace-search.test.ts` mengharuskan
response canonical (`supplierName`, `registeredQuantity`, `tiers`,
`registrationClosesAt`, `origin`, `pageSize`, dan `totalPages`) serta forwarding
`minPrice`/`maxPrice`. Implementasi lama masih mengembalikan raw RPC rows dan
tidak memiliki parameter harga.

### GREEN

Route search sekarang memvalidasi filter harga, menentukan origin UMKM/request/
Bandung, memanggil read-model RPC, dan memetakan row ke `MarketplaceItem`.
Repository client menggunakan fetch abortable dengan `cache: "no-store"`.
Migration read model menambahkan `search_batches` dan `get_marketplace_batch`
sebagai `security definer` dengan `set search_path = public`; keduanya hanya
mengembalikan batch `published` dan agregat quantity untuk status live.

```text
npm test -- tests/migrations/schema.test.ts tests/migrations/marketplace-read-model.test.ts tests/unit/api-marketplace-search.test.ts tests/unit/marketplace-api-repository.test.ts
Test Files  4 passed (4)
Tests       203 passed (203)
```

## Keputusan desain

- `origin` memakai koordinat eksplisit request jika diberikan, profil UMKM jika
  tersedia, atau Bandung sebagai fallback; listing dan peta nantinya memakai
  sumber yang sama.
- Jarak dan estimasi pickup yang tidak valid menjadi `null`, bukan angka palsu.
- `current_price_per_unit` memakai tier dengan `min_volume` tertinggi yang
  sudah tercapai dan fallback Tier 1; tier adalah threshold harga, bukan kuota
  kumulatif.
- RPC bersifat security-definer karena RLS registrasi melarang pembaca publik
  melihat baris UMKM lain. Respons hanya agregat.

## Tahap 4 — Detail UUID dan Share WhatsApp canonical

### RED/GREEN

Test baru membuktikan UUID invalid → 400, item read model kosong → 404,
kesalahan RPC → 500, serta forwarding koordinat viewer. Test share membuktikan
URL absolut memakai origin deployment dan menghapus query/hash termasuk `ref`
dan `utm_*` sebelum masuk ke pesan WhatsApp.

```text
npm test -- tests/unit/api-marketplace-detail.test.ts tests/unit/marketplace-share-link.test.ts tests/components/MarketplaceDetailClient.test.tsx tests/components/ProductCard.test.tsx
Test Files  4 passed (4)
Tests       47 passed (47)
```

Halaman detail kini memakai `/marketplace/[id]`, kartu memakai UUID batch, dan
mock detail/slug tidak lagi menjadi fallback production. `NEXT_PUBLIC_SITE_URL`
menjadi sumber canonical URL; hanya development/test yang memakai localhost.
