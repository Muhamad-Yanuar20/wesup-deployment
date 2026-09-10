import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Riwayat Laporan | Wesup", description: "Modul riwayat laporan Supplier Wesup." };

export default function SupplierReportHistoryPage() {
  return <SupplierModuleUnavailable title="Riwayat laporan belum tersedia" description="Riwayat laporan akan tersedia setelah endpoint pelaporan Supplier dan moderasi Admin selesai." />;
}