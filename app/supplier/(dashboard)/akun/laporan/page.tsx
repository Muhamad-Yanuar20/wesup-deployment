import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Laporan UMKM | Wesup", description: "Modul pelaporan Supplier Wesup." };

export default function SupplierReportFormPage() {
  return <SupplierModuleUnavailable title="Pelaporan UMKM belum tersedia" description="Pelaporan membutuhkan backend bukti dan moderasi Admin. Form demo disembunyikan sampai alur tersebut tersedia." />;
}