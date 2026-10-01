# Feedback UI — bukti TDD dan verifikasi

Tanggal: 1 Oktober 2026. Ruang lingkup: implementasi feedback UI non-landing pada Next.js 16.2.10 App Router, React 19. Rencana pengguna menjadi acuan; identitas Newsreader/Geist dan palet biru–slate dipertahankan dengan scope `.wesup-app` / `.wesup-feedback`.

## Red → green

| Regresi | Bukti sebelum perbaikan | Hasil setelah perbaikan |
|---|---|---|
| Primitive/timer toast | Tes fondasi mula-mula gagal karena primitive belum ada; dua tes timer gagal karena timer dimulai ulang dan tidak berhenti saat hover | Feedback.test.tsx + feedback-errors.test.ts: 13 tes lulus |
| Error keuangan/katalog Admin | Dua tes gagal: kegagalan finance terlihat seperti Rp0 dan katalog gagal terlihat kosong | FeedbackFlows.test.tsx: error terpisah dari kosong, retry lulus |
| GET terlambat/dibatalkan | Tes AbortError lintas realm gagal saat memakai instanceof | FeedbackResource.test.tsx: 3 tes lulus; konten lama dipertahankan dan response lama diabaikan |
| Logout gagal/hasil hilang | Tes tambahan memeriksa kegagalan verifikasi, 403 masih terautentikasi, POST hilang tetapi GET401 | LogoutAction.test.tsx: 3 tes lulus; tidak redirect atau mengulang POST sebelum hasil sesi pasti |
| Wizard validasi | Tes baru fokus/aria-invalid gagal sebelum field error dihubungkan | OfferWizard.test.tsx lulus, termasuk baseline draft lokal terisolasi dan penawaran baru bersih |
| Pembayaran belum pasti | Regresi mengharapkan unknown, implementasi lama menghasilkan unavailable | payment-ui-state.test.ts lulus; server tetap menentukan status pembayaran |
| Recovery onboarding | [onboarding-red.log](feedback-ui/onboarding-red.log): 1 gagal / 4 lulus, error SQL terlihat | [onboarding-green.log](feedback-ui/onboarding-green.log): 8 tes onboarding/login lulus; retry dan sanitasi pesan |

Tes ditulis sebelum perbaikan behavior terkait. Perubahan test pendaftaran mencerminkan hasil utama inline SuccessState menggantikan modal informasi. Adapter toast lama tetap kompatibel. Tidak menambahkan test yang hanya menyalin class styling.

Review menemukan label batas pembayaran memakai target countdown pembukaan. Tes tambahan menghasilkan **1 gagal / 6 lulus** ([payment-header-red.log](feedback-ui/payment-header-red.log)); setelah label memakai paymentClosesAt, **15 tes terkait lulus** ([payment-header-green.log](feedback-ui/payment-header-green.log)). Countdown target/budget tidak berubah.

## Arsitektur yang diimplementasikan

- `components/feedback/core.tsx`: Alert, InlineStatus, Spinner, AsyncButton, Skeleton/ContentSkeleton, Progress, EmptyState, ErrorState, SuccessState, UnavailableState, FieldFeedback. Primitive controlled tetap dapat dirender server.
- `ConfirmDialog.tsx`: Client Component native dialog, nama/deskripsi, Escape dan fokus kembali; dismissal diblokir selama pending; error tetap dalam keputusan.
- `GlobalToast.tsx`: satu provider existing; timer per item stabil, pause hover/focus/tab tersembunyi, deduplikasi ID, update/dismiss, antrean maksimum tiga, aksi persisten dan safe area mobile.
- `lib/feedback/errors.ts`: status/kode/field metadata/request ID dipertahankan; pesan teknis tidak disajikan langsung. 401 dibedakan dari pembatasan403. Abort tidak diumumkan.
- `use-resource.ts`: GET-only; generation + AbortController; initial skeleton, empty hanya setelah sukses, refresh gagal mempertahankan data. Tidak retry mutasi otomatis.
- Layout cabang marketplace/UMKM mempertahankan shell. Supplier memakai layout existing; Admin memakai sidebar/header operasional. Boundary non-landing memakai `unstable_retry()` sesuai docs Next terpasang, tanpa root loading/error baru. Loading/error pada satu cabang tidak menangani async guard layout di atasnya.

## Integrasi fitur

| Area | Behavior penting |
|---|---|
| Auth/akun | Logout bersama terverifikasi; hasil signup inline; error login ramah; profil gagal memiliki retry |
| Marketplace | Existing Zustand dipertahankan; error request dibatalkan senyap; rute map memiliki retry/fallback; hasil ikut tidak menjanjikan pembayaran langsung |
| Pesanan/pembayaran UMKM | Detail lama tetap tersedia saat refresh gagal; kode pickup bisa dicoba lagi; countdown tidak diumumkan per detik; unknown/pending/paid dibedakan; callback Snap bukan bukti pembayaran |
| Komplain/refund/ulasan/bantuan | Progress persiapan foto berdasarkan jumlah selesai; loading tidak role alert; bukti dan isian gagal tetap tersedia; rekening berubah dikonfirmasi; hasil utama lokal |
| Supplier | Recovery draft eksplisit dan isolated baseline tetap; warning storage lokal; toast terbit hanya setelah server sukses; konfirmasi tutup/siap/jadwal/pencairan/rekening; finance gagal bukan saldo nol; fulfillment tanpa feedback sukses ganda |
| Admin | Katalog/sengketa/antrean/refund/bantuan membedakan error dan kosong; dialog mempertahankan alasan pada gagal; menu belum tersedia tidak mengarah ke404; refund tetap read-only |
| Notifikasi/docs/demo/unavailable | GET lokal dengan skeleton/error/retry, operasi read state terkunci; Swagger menerima spec terkonfirmasi; modul unavailable tanpa data demo/pesan backend |

## Pemeriksaan otomatis

- `npx vitest run --exclude 'tests/live/**'`: **185 berkas, 1.425 tes lulus**. [Log](feedback-ui/unit-run.log).
- `npx tsc --noEmit`: **lulus**. [Log](feedback-ui/typecheck.log).
- `npm run lint`: **0 error, 200 warning baseline** (sebagian besar berada dalam skill/fixture lama). [Log](feedback-ui/lint.log).
- `npm run build`: **lulus**; prebuild read-only memverifikasi schema/RLS/grants. [Log](feedback-ui/build.log).
- Playwright feedback UI: **5 tes lulus** pada build produksi lokal port3101. [Log](feedback-ui/browser-run.log).
- Regresi browser navigasi/draft: **6 tes lulus**, hasil akhir dicatat pada [log](feedback-ui/navigation-regression.log).

## Browser dan screenshot

Width 1440, 768, 390, 320; tinggi1000. Sesi autentikasi memakai akun Supabase disposable, dibersihkan melalui auth.users cascade. GET/POST keuangan, katalog Admin, dan detail pesanan diintercept dengan fixture; tidak ada pembayaran, transfer, penerbitan, atau keputusan sengketa nyata.

Diperiksa: request lambat500ms; error500 dengan pesan teknis disembunyikan; retry berhasil; form keuangan berlabel; nominal/penerima dialog; Tab/Shift+Tab; Escape diblokir saat pending700ms; error dialog bertahan; fokus kembali; wizard kosong dan validasi; kapasitas/satuan sejajar pada desktop/tablet; stale detail dipertahankan setelah abort dan offline; overflow semua lebar; reduced motion; zoom200% (CSS zoom2 pada Chromium, bukan sertifikasi semua browser).

Screenshot final: `feedback-ui/{finance-error,finance,finance-dialog,wizard,admin,order,login}-{1440,768,390,320}.png`, ditangkap dari document top setelah state dipastikan. Semua berkas dibuka untuk memvalidasi kontennya. Capture full-page menampilkan elemen fixed pada posisi viewport tempat diambil; backdrop dialog hanya menutupi viewport. Salinan utama di `.impeccable/review/`.

Putaran awal memperbaiki breakpoint desktop tablet, containing block navigasi fixed karena backdrop-filter header, padding error, hierarki judul Admin, label/hint kontrol dan false counter ketika error. Locator browser awal tertukar dengan `__next-route-announcer__`; diperbaiki agar mengamati alert fitur, bukan mengubah perilaku aplikasi. Login fixture digunakan ulang agar tidak terkena rate limit produksi.

## Landing dan batas verifikasi

`app/page.tsx`, `app/globals.css`, `components/landing`, `lib/landing`, font root dan token landing tidak diubah dalam implementasi feedback. Provider sesi root adalah baseline pekerjaan navigasi sebelumnya. Selector baru dibatasi ke non-landing dan komponen feedback; landing tidak memakai shell tersebut. `landing-after.png` adalah capture reduced motion. `landing-before.png` awal tidak settle (overlap/animasi), sehingga **bukan golden valid** dan tidak digunakan untuk mengklaim pixel equivalence. Bukti isolasi utama adalah diff sumber dan scope selector; tidak mengklaim pixel equality.

Suite live backend tidak dijalankan ulang pada tahap feedback ini. Unit/migration regresi dan browser memakai fixture; popup Snap/provider pembayaran, kamera perangkat, transfer bank dan upload nyata tidak diuji end-to-end. Status pembayaran tetap direkonsiliasi server dan transport fetch tidak menampilkan progress byte palsu. Tidak ada API publik/migrasi database baru. PRD privat dan perubahan lokal pengguna dipertahankan; tidak ada commit/deploy.

## Impeccable

Detector dijalankan sekali pada target UI yang berubah: [detector.json](feedback-ui/detector.json), enam kandidat. Empat adalah border corner scanner yang fungsional, satu garis timeline sengketa, satu pasangan slate700/blue50 hover yang memiliki kontras gelap; temuan dibawa ke reviewer untuk penilaian konteks. Tidak ada aset raster baru sehingga tidak ada pekerjaan provenance aset.

Review awal berstatus **fix** ([finish-review.md](feedback-ui/finish-review.md)): tiga koreksi material diterapkan dalam satu batch, yaitu tanggal penutupan pembayaran, penghapusan kicker pada tiga halaman, dan variant embedded untuk menghindari state berbingkai ganda. Recapture memakai viewport/path yang sama; tes browser kembali 5/5. Verdict akhir **ship**: ketiga koreksi terselesaikan, tanpa regresi dari batch koreksi pada permukaan yang dinilai. Verdict ini mencakup daftar koreksi tersebut, bukan audit ulang seluruh aplikasi; lihat [finish-verdict.md](feedback-ui/finish-verdict.md). Dokumentasi perbandingan dengan desain incumbent selesai pada [design-evidence.md](feedback-ui/design-evidence.md), tanpa perubahan DESIGN.md atau konfigurasi sistem desain. Laporan ini tidak mengklaim sertifikasi WCAG/Lighthouse.
