# Tombol submit nonaktif terlihat nonaktif

Tanggal: 2026-10-22.

## Penyebab dan perubahan

Tombol submit hanya memakai `disabled:opacity-50`, sehingga pada latar kertas
tombol nonaktif hampir menyerupai tombol aktif dan alasannya tidak dijelaskan.
`JoinBatchForm` kini:

- menghitung `termsRequired` sekali (policy v2, usulan awal, atau minimum awal)
  dan memakainya untuk `submitDisabled` maupun payload persetujuan;
- menerapkan resep nonaktif `bg-wesup-paper-sub text-wesup-ink-sub` +
  `disabled:cursor-not-allowed` (kontras teks tetap terbaca);
- menampilkan petunjuk "Centang persetujuan syarat di atas untuk mengaktifkan
  tombol konfirmasi." selama tombol nonaktif karena syarat.

Label dan perilaku aktif tidak berubah.

## Red → green

- Red: 2 tes terms-gate gagal (tombol tidak memakai resep nonaktif, petunjuk
  tidak ada).
- Green: 2 tes terms-gate lulus.
- Verifikasi browser: tombol `Konfirmasi ikut pesanan`, `disabled=true`,
  `cursor: not-allowed`, `background-color: rgb(234, 232, 227)`, dan petunjuk
  tampil.
- Gate akhir: 222 berkas / 2.111 tes, lint 0 error (13 warning lama), build sukses.

Bukti: [red unit](disabled-consent-submit/red-unit.log),
[green unit](disabled-consent-submit/green-unit.log),
[browser](disabled-consent-submit/browser.log),
[tombol](disabled-consent-submit/disabled-submit.png).
