# Pembukaan pembayaran lebih awal — TDD dan verifikasi

Tanggal: 1 Oktober 2026. Implementasi mengikuti rencana pengguna. Landing dan PRD tidak diedit untuk fitur ini; perubahan lokal sebelumnya dipertahankan. Migrasi baru belum diterapkan pada database eksternal.

## Red → green

| Regresi yang ditulis lebih dahulu | Bukti red | Perbaikan dan green |
|---|---|---|
| Target independen, batas kapasitas, peserta aktif, quorum, revisi, cutoff | Import helper baru gagal karena modul belum ada | `lib/transactions/early-payment.ts`;14 kasus lulus |
| Panel supplier dan keputusan UMKM | Import komponen baru gagal | Komponen menggunakan ConfirmDialog existing, pending dan GET recovery;2 kasus lulus |
| Kontrak konfigurasi/close/decision | Konflik snapshot memakai pesan Draft dari mapper lama | Override copy konflik transaksi;10 kasus API lulus |
| Registrasi legacy dengan distributed lock |12 regresi baseline gagal pada mock lock dan bentuk payload lama | Mock mengakuisisi/melepas lock; payload lama tetap kompatibel saat ketentuan baru tidak ada |
| SQL revisi persetujuan | Keputusan idempotent revisi lama bisa lolos sebelum pengecekan revisi terakhir | Pengecekan revisi terbaru mendahului hasil idempotent;SQL regression lulus |
| Default target dan recovery draft | Target harus mengikuti kapasitas awal/recovery, mempertahankan nilai eksplisit |2 kasus wizard baru, termasuk recovery eksplisit;tes terkait42 lulus |

Kegagalan awal tercatat pada keluaran sesi eksekusi; log yang disimpan di bawah adalah hasil akhir, bukan salinan red yang direkonstruksi. Tidak ada klaim bahwa log final memuat red.

## Hasil akhir

- Seluruh tes non-live:188 berkas /1.453 tes lulus (`early-payment-unit.log`).
- Setelah koreksi hierarki UI:42 tes terkait lulus (EarlyPayment, OfferWizard, API early payment, eligibility).
- TypeScript `npx tsc --noEmit`:lulus (`early-payment-typecheck.log`, kosong berarti tanpa diagnostic).
- `npm run lint`:0 error,200 peringatan existing (`early-payment-lint.log`).
- `npm run build`:lulus Next16.2.10 (`early-payment-build.log`).
- PostgreSQL terisolasi:44 pemeriksaan lulus (`early-payment-database.log`).
- Playwright:8 perjalanan lulus pada1440px dan390px;2 feature journeys +6 navigasi/draft baseline (`early-payment-browser.log`). Capture confirmation mengulang2 feature journeys untuk memperbaiki posisi bukti target di atas bottom navigation.

## Cakupan database

`tests/database/early-payment-opening.mjs` mengeksekusi migrasi dan RPC asli melalui PostgreSQL WASM (PGlite) di memori. Dependency dipasang di direktori temporary, tidak ditambahkan ke manifest/lockfile project. Bootstrap adalah model tabel incumbent yang relevan; validator harga/jadwal berasal dari migrasi existing.

Diuji:kompilasi seluruh migrasi baru; target publikasi wajib, draft parsial;kolom target terpisah dari ambang diskon;target locked setelah peserta;di bawah/tepat target;approval sebagian/lengkap/penolakan/revisi;peserta baru dengan consent;withdraw dan rejoin;akses keputusan akun tertangguh;cutoff dan kapasitas penuh mengikuti kebijakan asli;harga tier/base;24jam aktual;jadwal pickup tidak berubah;close idempotent dengan deadline sama;invoice dan payment_due tepat sekali;akses lintas supplier/pesanan;RLS read dan larangan directwrite;anonymous private context;rollback seluruh close saat insert invoice gagal.

Database menentukan eligibility dan mengambil row lock batch sebelum mutasi;jalur HTTP konfigurasi/keputusan/close/join/withdraw memakai distributed lock existing. Pengujian ini tidak membuktikan kontensi multi-koneksi Supabase atau perilaku penuh chain migrasi/RLS produksi. Withdraw/rejoin test mengubah registration fixture untuk menciptakan state;RPC withdrawal incumbent memiliki lock batch yang sama. Race database lintas koneksi tetap perlu diuji pada staging.

## Cakupan browser dan feedback

Fixtures autentikasi disposable dibuat dan dihapus melalui pola QA incumbent. Batch/order/configure/close/decision diintercept; tidak menerbitkan tagihan, mengubah batch bisnis, atau memanggil pembayaran nyata.

- Nilai target awal100, capacity80 menyinkronkan target80, target eksplisit40 tetap ketika capacity90.
- Supplier:target40/volume45/capacity100, quorum2/2;review tier2 Rp8.000;409 saat volume berubah46;GET recovery sebelum review kedua;payload45 lalu46;toast sukses tunggal.
- UMKM:persetujuan;respons POST hilang tetapi keputusan tersimpan pada fixture;GET memulihkan accepted;hanya satu POST.
- Native dialog:Tab/Shift+Tab tetap dalam dialog, Escape diblokir selama pending;slow response350–500ms;reduced motion;mobile tanpa overflow horizontal.
- Existing nav:menu stabil pada sesi lambat/remount,satu highlight;wizard baru bersih,recovery hanya setelah pilihan pengguna;kapasitas/satuan sejajar.

Screenshot12 states berada di `early-payment/`. Fullpage mobile menangkap bottomnav pada posisi viewport awal1000px;target juga dicapture pada viewport yang dipusatkan agar tidak tertutup nav. Bukan audit WCAG menyeluruh, bukan coverage320/768px, offline semua fitur, atau keputusan finansial nyata.

## Impeccable

Extension mode Operate mempertahankan Newsreader/Geist, blue/slate, surface dan feedback incumbent. Satu detector run atas lima file fitur menghasilkan `[]`. Own batched inspection mengoreksi hierarchy konfigurasi (secondary disclosure saat proposal aktif) dan fixture order agar jumlah cocok. Review independen dan dokumentasi desain disimpan di `early-payment/finish-review.md` serta `early-payment/design-evidence.md`. Verdict final mengikuti laporan tersebut; tidak diperluas menjadi persetujuan rollout database.

## Rollout yang belum dijalankan

Tidak ada kredensial staging terpisah yang dikonfigurasi. Migrasi produksi tidak diterapkan. Sebelum aktivasi:terapkan migrasi ini pada staging yang terverifikasi, uji chain migrasi/incumbent RLS dan kontensi join/withdraw/close/cutoff/fullcapacity multi-koneksi,verifikasi batch lama null tetap sama,lalu deploy aplikasi setelah migrasi. Jangan aktifkan build ini sebelum migration schema/RPC tersedia. Detail rollout dan kontrak ada di `docs/early-payment-opening.md`.
