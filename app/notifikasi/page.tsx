import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifikasi | Wesup",
  description: "Pusat notifikasi dan pengingat aktivitas Anda di Wesup.",
};

/*
 * TODO: Halaman "Notifikasi" - placeholder sementara agar tidak 404.
 *
 * Tujuan: Pusat notifikasi & pengingat untuk semua peran (UMKM / Supplier / Admin).
 *
 * Referensi PRD:
 *  - PRD 2.4.5 "Notifikasi & Audit" (migration: notifications/audit).
 *  - Notifikasi berbasis event peran: pesanan baru, pembayaran lunas, siap diambil,
 *    escrow dirilis, dispute, rating, verifikasi supplier.
 *
 * Draft spesifikasi untuk poin generate Anda nantinya:
 *  - Feed kronologis terbalik dengan status: unread (dot biru) vs read.
 *  - Aksi + link dalam notifikasi (klik → navigasi ke konteks order/batch).
 *  - Filter peran & jenis event; tombol "tandai semua dibaca".
 *  - Badge unread di NavigationBar (bisa digabung di komponen ikon).
 *  - Data layer: mock dulu; wiring ke tabel `notifications` Supabase di fase data.
 */
export default function NotifikasiPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Notifikasi
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Pengingat dan pembaruan aktivitas Anda di Wesup.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Halaman ini masih placeholder. Fitur penuh akan hadir segera.
        </div>
      </div>
    </Layout>
  );
}
