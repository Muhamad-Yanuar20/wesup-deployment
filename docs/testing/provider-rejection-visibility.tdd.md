# Alasan penolakan provider terlihat oleh UMKM

Tanggal: 2026-10-22.

## Penyebab dan perubahan

`MidtransProviderError` hanya menyimpan status dan pesan generik, sehingga alasan
penolakan Midtrans (mis. gross amount tidak sesuai) hilang di rute charge. Panel
pembayaran juga menampilkan pesan generik tanpa kode rujukan.

Perubahan:

- `lib/payments/midtrans.ts`: detail provider (`fromProvider`, `providerMessage`,
  `errorMessages`, `requestId`, `raw`) diekstrak dari `error_messages[]`,
  `status_message`, dan `request_id`.
- Rute charge: penolakan provider non-retryable → 502
  `PAYMENT_PROVIDER_REJECTED` dengan `details.providerMessage`,
  `details.errorMessages`, `details.providerRequestId`; error validasi lokal
  mempertahankan status aslinya. Percobaan disimpan
  (`status: failed`, `provider_status: rejected`, payload provider).
  Percobaan yang sudah terminal dipakai ulang tanpa membuat percobaan baru.
- `lib/payments/client-errors.ts`: pesan ramah + " Alasan provider: …".
- `UmkmPaymentPanel`: status terminal mematikan tombol bayar dan "Coba lagi",
  menampilkan `Kode rujukan`, dan menyarankan menghubungi bantuan.

## Red → green

- Red: 5 tes gagal (adapter Midtrans, pemetaan client-errors, rute charge,
  panel).
- Green: 28 tes di 4 berkas lulus (`midtrans`, `payment-client-errors`,
  `api-umkm-payment-snap`, `UmkmPaymentPanel`).
- Verifikasi browser: charge Midtrans nyata membalas 201 pada pesanan Rp 800
  (reconcile sandbox tetap `PAYMENT_PROVIDER_MISMATCH` — perilaku lama di luar
  empat perbaikan), sehingga keadaan terminal diuji dengan memotong respons
  memakai bentuk body yang dihasilkan rute: alert menampilkan alasan provider dan
  kode rujukan, tombol bayar dan "Coba lagi" tidak ada.
- Gate akhir: 222 berkas / 2.111 tes, lint 0 error (13 warning lama), build sukses.

Bukti: [red unit](provider-rejection-visibility/red-unit.log),
[green unit](provider-rejection-visibility/green-unit.log),
[browser](provider-rejection-visibility/browser.log),
[alert](provider-rejection-visibility/provider-rejection.png).
