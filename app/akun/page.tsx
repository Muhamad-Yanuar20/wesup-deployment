import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Akun | Wesup",
  description: "Kelola profil dan pengaturan akun Anda di Wesup.",
};

/*
 * TODO: Halaman "Akun" - placeholder sementara agar tidak 404.
 *
 * Tujuan: Pusat profil & pengaturan akun (UMKM / Supplier / Admin).
 *
 * Referensi PRD:
 *  - PRD profil & verifikasi user.
 *  - Untuk Supplier: status verifikasi (`supplier_profiles.verification_status`),
 *    full name, kontak, lokasi, is_approved.
 *
 * Draft spesifikasi untuk poin generate Anda nantinya:
 *  - Kartu profil: foto/initials, nama, email, role, status akun/verifikasi.
 *  - Pengaturan: ganti password (pakai /api/auth/*), data kontak, preferensi notifikasi.
 *  - Untuk Supplier ikuti pola `components/supplier/disbursement/*` dan link ke
 *    `/supplier/akun/rekening`, `/supplier/akun/escrow`, `/supplier/akun/laporan`.
 *  - Tampilkan tombol Keluar (sign out).
 *  - Data layer: mock dulu; wiring ke `profiles` + `supplier_profiles` di fase data.
 */
export default function AkunPage() {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Akun
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Kelola profil, keamanan, dan pengaturan akun Anda.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Halaman ini masih placeholder. Fitur penuh akan hadir segera.
        </div>
      </div>
    </Layout>
  );
}
