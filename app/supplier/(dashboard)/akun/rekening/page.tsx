import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rekening Supplier | Wesup", description: "Modul rekening Supplier Wesup." };

export default function SupplierDisbursementPage() {
  return <SupplierModuleUnavailable title="Rekening Supplier belum tersedia" description="Pengaturan rekening dan pencairan dana membutuhkan endpoint backend yang aman. Modul demo dinonaktifkan sampai penyimpanan nyata tersedia." />;
}