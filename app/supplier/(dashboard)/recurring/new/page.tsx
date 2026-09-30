import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buat Postingan Berulang | Wesup", description: "Modul postingan berulang Supplier Wesup." };

export default function NewRecurringPage() {
  return <SupplierModuleUnavailable title="Buat postingan berulang belum tersedia" description="Pembuatan jadwal recurring dinonaktifkan sampai backend generator batch tersedia." />;
}