import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pesanan | Wesup",
  description: "Kelola pesanan Anda di Wesup.",
};

/*
 * TODO: Halaman "Pesanan" - placeholder sementara agar tidak 404.
 *
 * Tujuan: Pusat manajemen pesanan untuk user (UMKM buyer / Supplier).
 *
 * Referensi PRD:
 *  - PRD 2.1.5 "Dasbor Manajemen UMKM & Serah Terima" (Supplier)
 *  - PRD 2.x "Manajemen Pesanan" (UMKM)
 *
 * Draft spesifikasi untuk poin generate Anda nantinya:
 *  - Tabs / filter status: Terdaftar, Menunggu Bayar, Lunas, Sudah Diambil, Tidak Hadir, Dibatalkan.
 *  - Daftar batch/order dengan ringkasan qty, total, status, dan tombol aksi kontekstual.
 *  - Untuk buyer: tombol menuju pembayaran (QRIS) & riwayat.
 *  - Untuk supplier: shortcut ke `/supplier/batch/[id]/orders` dan `/supplier/batch/[id]/pickup`.
 *  - Tabel desktop + kartu mobile (ikuti pola OrderListClient), skeleton/error/empty state.
 *  - Data layer: mock dulu (lihat lib/supplier-fulfillment), wiring ke Supabase di fase data.
 *
 * Komponen terkait (bisa dipakai ulang): `components/supplier/fulfillment/OrderListClient.tsx`,
 * `components/supplier-batch/SupplierBatchDetailClient.tsx`.
 */
export default function PesananPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Pesanan
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Kelola pesanan Anda — status, pembayaran, dan serah terima.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Halaman ini masih placeholder. Fitur penuh akan hadir segera.
        </div>
      </div>
    </Layout>
  );
}
