# Duplikat join: konflik, bukan sukses palsu

Tanggal: 2026-10-22.

## Penyebab dan perubahan

`join_batch_v2` menandai join ulang dengan `idempotent=true` dan mengembalikan
kuantitas yang benar-benar terdaftar. Rute `/api/registrations` mengabaikan flag
itu dan tetap membalas 201, sehingga UMKM melihat "Pendaftaran berhasil" padahal
kuantitas lama yang berlaku. Jalur insert lama juga membalas 409 tanpa kode.

Perubahan:

- Rute policy v2 membalas 409 `REGISTRATION_ALREADY_EXISTS` dengan
  `details.registrationId`, `details.quantity` (kuantitas tersimpan), dan
  `details.canWithdraw` (dibaca dari `capabilities.canWithdraw` RPC).
- Jalur insert lama ikut memakai kode `REGISTRATION_ALREADY_EXISTS`.
- `JoinBatchForm` menampilkan panel konflik: kuantitas aktif, tautan
  "Buka pesanan saya", dan tombol "Batalkan & daftar ulang" saat
  `canWithdraw=true`; registrasi terkunci menjadi error terminal tanpa aksi.
- Tombol batalkan-dan-daftar-ulang memanggil
  `POST /api/umkm/orders/{registrationId}/withdraw` lalu join ulang dengan
  kuantitas form.
- Skema 409 `registrationConflictSchema` ditambahkan ke OpenAPI.

Tidak ada migrasi database; RPC yang ada sudah mengembalikan kapabilitas.

## Red → green

- Red: 2 tes rute + 3 tes komponen gagal (balasan 201 palsu, panel tidak muncul,
  aksi batal tidak ada).
- Green: 35 tes di 2 berkas lulus (`tests/unit/api-registrations.test.ts`,
  `tests/components/JoinBatchForm.test.tsx`).
- Verifikasi browser: 409 asli dari RPC (dengan `canWithdraw: true`), panel
  konflik tampil, lalu alur batal + daftar ulang nyata membuat pesanan baru dan
  mengarahkan ke detail pesanan.
- Gate akhir: 222 berkas / 2.111 tes, lint 0 error (13 warning lama), build sukses.

Bukti: [red unit](duplicate-join-conflict/red-unit.log),
[green unit](duplicate-join-conflict/green-unit.log),
[browser](duplicate-join-conflict/browser.log),
[panel](duplicate-join-conflict/conflict-panel.png).
