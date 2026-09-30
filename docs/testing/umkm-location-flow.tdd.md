# UMKM Location-Aware Registration — TDD Evidence

Tanggal verifikasi: 2026-09-09

## Cakupan

Alur ini menyimpan titik lokasi saat signup UMKM, tidak membuat sesi login otomatis,
menampilkan dialog sukses dengan pilihan Tutup/Login, memakai Leaflet yang sama
saat onboarding, dan menghitung origin marketplace dari profil UMKM yang sedang
login.

## RED/GREEN

Kontrak yang diuji:

- payload signup membawa latitude/longitude tanpa menerima role atau userId;
- koordinat wajib berada dalam radius layanan Bandung;
- signup menyimpan lokasi melalui RPC service-role dan membersihkan auth user bila
  penyimpanan profil gagal;
- dialog signup memiliki focus trap, Escape, tombol Tutup, tombol Login, dan pesan
  konfirmasi email;
- profil dengan lokasi saja tetap incomplete sampai nama usaha dan alamat diisi;
- Join Batch menolak profil parsial;
- origin profil UMKM sendiri mengalahkan koordinat request, sedangkan UMKM lama
  memakai fallback Bandung dengan `needsProfileLocation: true`;
- listing dan detail memakai resolver origin yang sama.

Test files utama:

```text
 tests/unit/umkm-registration-service.test.ts
 tests/unit/umkm-signup.test.ts
 tests/components/UmkmSignupForm.test.tsx
 tests/components/UmkmRegistrationSuccessDialog.test.tsx
 tests/components/UmkmOnboardingForm.test.tsx
 tests/unit/umkm-profile-completion.test.ts
 tests/unit/marketplace-origin.test.ts
 tests/unit/api-marketplace-search.test.ts
 tests/unit/api-marketplace-detail.test.ts
```

## Keputusan desain

- Guest tetap memakai pusat layanan Bandung dan radius default 10 km; parameter
  koordinat eksplisit dipertahankan hanya untuk kompatibilitas API.
- Saat sesi berperan UMKM, koordinat dari profil sendiri selalu menang atas
  parameter URL. Query profil selalu memakai `eq("user_id", context.userId)`.
- Row profil yang hanya berisi lokasi ditampilkan sebagai “lokasi tersimpan,
  profil usaha belum lengkap”, bukan kartu usaha kosong.
- Tidak ada reverse geocoding; alamat tetap diisi manual saat onboarding.

## Verification

- `npx vitest run --exclude tests/live/**`: 105 test files, 888 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, 0 errors, 10 pre-existing warnings.
- `npm run build`: passed; seluruh route aplikasi berhasil dikompilasi.

## Known gaps

- Geolocation dan tile OpenStreetMap tetap bergantung pada izin browser,
  secure-context, dan koneksi tile service.
- Live Supabase/RLS tests memerlukan credential `.env` dan migration database
  yang sudah diterapkan pada environment development. Pada verifikasi ini, 7
  live assertions gagal karena database development masih belum menerapkan RLS
  dan RPC migration yang sudah ada di branch.