# Pembukaan pembayaran lebih awal

## Otoritas dan kompatibilitas

Target baru `batches.early_payment_minimum_quantity` nullable. Null pada batch lama mempertahankan kebijakan asli;tidak ada backfill massal. `min_quantity` tetap ambang tier diskon incumbent. Penawaran baru mempublikasikan target independen,default kapasitas,1..kapasitas;draft boleh parsial. Target tidak dapat diubah setelah pernah ada registration,termasuk peserta yang batal.

Untuk batch berpeserta,usulan immutable per revisi disimpan pada `early_payment_proposals`;keputusan pada `early_payment_decisions` terikat registration dan timestamp join. Peserta aktif harus seluruhnya accepted,volume aktif mencapai target,belum cutoff,status published. Penolakan memblokir usulan;cancel/revisi membatalkan otorisasi sebelumnya. Rejoin memerlukan assent baru. Last consent tidak memanggil close.

Tabel baru RLS read-only bagi authenticated pemilik supplier/peserta terkait;write melalui guarded SECURITY DEFINER RPC dengan search_path tetap. Status akun suspended UMKM boleh merespons order miliknya,tidak diberi hak join baru. RPC mengecek pemilik bahkan untuk close idempotent.

## Kontrak HTTP

- POST `/api/suppliers/offers`:draft payload menerima `earlyPaymentMinimumQuantity`;publikasi memvalidasi target dan SQL menyimpannya terpisah dari tier.
- POST `/api/suppliers/batches/:id/early-payment`: `{minimumQuantity,requestId}` mengatur batch tanpa history atau membuat revisi usulan pada batch berpeserta. `{action:"cancel",proposalId,revision}` membatalkan usulan terikat revisi.
- POST `/api/umkm/orders/:orderId/early-payment-decision`: `{proposalId,revision,decision:"accepted"|"rejected"}` untuk pesanan sendiri.
- POST `/api/suppliers/batches/:id/close`: pembukaan baru membutuhkan `{confirmation:{registeredQuantity,participants,tierNumber,unitPrice,proposalId,proposalRevision}}`. Nilai UI dibandingkan snapshot server;perbedaan409 memerlukan GET/review ulang. Legacy tanpa target/usulan mempertahankan close path lama.
- Supplier transaction snapshot dan UMKM detail menambahkan `earlyPayment` (target asli dan current,volume,quorum,history,capabilities,reason,tier/price,proposal+decision). `canCloseBatch` dipertahankan. Marketplace offer context membawa ketentuan untuk checkbox join.

Shared distributed lock registration melindungi mutasi HTTP per batch;RPC menggunakan row lock batch yang sama dengan v2 join/withdraw/core close. Core close menangani manual/capacity/cutoff,idempotensi,snapshot harga,invoice dan notification dalam satu transaksi. Waktu bayar effective24jam sejak actual close;timeline pickup tidak digeser. Notifikasi usulan `batch_update`;tagihan `payment_due` menautkan registration lewat mekanisme notifikasi incumbent.

## UI dan hasil belum pasti

Wizard menyimpan target dalam draft/recovery/copy. Supplier memantau target terpisah kapasitas dan tier,mereview harga/volume/quorum pada ConfirmDialog. Editing usulan aktif adalah secondary disclosure;primary action membuka pembayaran. Buyer menerima alert persisten dan pilihan setuju/aturan sebelumnya. Tidak ada penalti tambahan.

POST tidak diulang otomatis saat respons hilang. Dialog menawarkan GET terbaru;baru setelah review ulang aksi dapat dikirim. Mutasi sukses menghasilkan satu toast;refresh gagal mempertahankan snapshot dan pesan pembaruan,tidak mengubah sukses menjadi gagal menyimpan. Callback UI bukan otoritas pembayaran.

## Penerapan

Migration baru: `supabase/migrations/20261001000100_early_payment_opening.sql`. Jangan mengubah file migration incumbent. Deploy schema/RPC dahulu,aplikasi sesudahnya. Tidak ada cron,perubahan Midtrans/escrow/refund/no-show,atau migration produksi yang dijalankan oleh pekerjaan ini.

Staging gate sebelum rollout:

1. Verifikasi database staging terpisah dari production;apply chain migrations pada schema staging/snapshot yang sesuai.
2. Periksa batch lama (target null) tetap sama sebelum konfigurasi/usulan,publikasi baru required target dan native draft/copy.
3. Jalankan concurrent join/withdraw/consent/manualclose/fullcapacity/cutoff pada batch fixture;pastikan satu close,invoice/notif tepat sekali,24jam efektif dan pickup sama.
4. Uji real RLS,akses own/cross account,suspended recovery,rollback invoice failure dan response-loss readback dengan akun uji.
5. Uji browser supplier/buyer bersama,baru aktifkan build. Tidak retry mutation finansial otomatis;rollback aplikasi harus menjaga data usulan/keputusan yang sudah diterima.

Bukti lokal ada di `docs/testing/early-payment-opening.tdd.md`.44 isolated PostgreSQL checks bukan pengganti staging acceptance atau true contention test.
