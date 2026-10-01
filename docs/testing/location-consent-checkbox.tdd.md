# Checkbox persetujuan lokasi pengambilan

Tanggal: 2026-10-01.

## Penyebab dan perubahan

Checkbox lama berupa button dengan tinggi/lebar 20 px, tetapi aturan global
button min-height 44 px mengalahkan tinggi tersebut. Pemeriksaan browser
sebelum perubahan membuktikan ukurannya 20 × 44 px di desktop dan mobile.

Kontrol diganti menjadi input checkbox native 20 × 20 px di dalam label.
Pengecualian min-height untuk checkbox native yang sudah ada kini berlaku;
shrink-0 dan self-start menjaga ukuran saat teks membungkus. Seluruh baris teks
dapat diklik, dengan dukungan fokus keyboard dan Space. Copy, warna panel,
callback dan timestamp persetujuan dipertahankan. Tidak ada perubahan CSS
global, landing, API, atau aturan transaksi.

## Red → green

- Tes unit awal gagal karena teks label tidak terhubung ke kontrol.
- Tes browser awal gagal: tinggi aktual 44 px, seharusnya 20 px, di kedua viewport.
- Setelah perbaikan: 2 tes unit dan 2 tes browser lulus. Klik judul/deskripsi
  mengubah nilai tepat satu kali; Space berfungsi; timestamp dibuat/dihapus
  sesuai persetujuan; ukuran tepat 20 × 20 px dan tidak ada overflow horizontal.
- Browser fixture membundel komponen asli dengan Vite existing dan merendernya
  memakai CSS aplikasi pada halaman login. Bypass CSP hanya di konteks pengujian;
  tidak ada akun atau transaksi yang dibuat. Ini pengujian komponen terisolasi,
  bukan pengujian registrasi batch lengkap.
- Viewport: 1440 px dan 390 px. Inspeksi visual akhir: kontrol kotak, judul
  sejajar, teks membungkus tanpa meregangkan kontrol. Outline biru pada gambar
  menunjukkan fokus keyboard setelah pengujian Space.
- Pemeriksaan akhir sebelum push: seluruh 1.477 tes (194 berkas) dan build
  produksi lulus. Tes integrasi detail marketplace kini memeriksa checked native,
  serta memastikan tombol Daftar hanya aktif sesudah persetujuan.
- TypeScript dan lint berkas terkait lulus. Detector layout: tidak ada temuan.

Panduan Next.js terpasang dan skill Impeccable digunakan untuk koreksi terbatas.

Bukti: [red unit](checkbox/red-unit.log), [red browser](checkbox/red-browser.log),
[green unit](checkbox/green-unit.log), [green browser](checkbox/green-browser.log),
[desktop](checkbox/desktop.png), [mobile](checkbox/mobile.png).
