# UMKM Registration RPC Permission Recovery — TDD Evidence

Tanggal: 2026-09-10
Branch: marketplace

## Akar masalah

Log Supabase menunjukkan Auth signup berhasil (`200`), kemudian `create_umkm_registration` gagal (`403`). Diagnostic call dengan secret key mengembalikan `42501: permission denied for table users` karena RPC `SECURITY INVOKER` membaca `auth.users`. Schema Auth tidak boleh diberi grant tambahan untuk kebutuhan ini.

## Siklus RED → GREEN

- Migration contract awal gagal karena migration repair belum memiliki implementasi dan RPC masih bergantung pada `auth.users`.
- RPC diperbaiki agar memvalidasi `profiles` (row dibuat oleh trigger Auth) dan memakai foreign key `umkm_profiles.user_id → profiles.id` sebagai anchor.
- Test migration kembali hijau.
- Test endpoint awal gagal karena correlation ID belum ditulis ke log.
- Route diperbarui untuk mencatat stage, message, dan correlation ID tanpa mengirim detail database ke browser; test kembali hijau.

## Perubahan

- Migration `20260910023101_umkm_registration_rpc_without_auth_users.sql` mempertahankan signature, `SECURITY INVOKER`, validasi role/status/lokasi, idempotensi, serta grant `service_role` saja.
- Regression live membuat akun disposable, memverifikasi satu row `profiles` dan satu row `umkm_profiles` dengan UUID sama, menguji retry, guard role/status/lokasi, serta membersihkan user setelah test.

## Verifikasi

- Migration diterapkan ke project `woxgghuoeljagnkldqtf`; local/remote migration history tersinkron hingga `20260910023101`.
- Diagnostic RPC unknown profile: `400 P0001 umkm registration profile does not exist`.
- Live signup/RLS suites: 244 passed.
- Non-live regression: 898 passed.
- TypeScript: passed.
- Production build: passed.
- Security advisor level error: no issues found.
- Lint: 0 errors; warning yang ada berasal dari file/test legacy, termasuk perubahan lokal pengguna pada `app/page.tsx`.
