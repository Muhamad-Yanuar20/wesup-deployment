import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Postingan Berulang | Wesup", description: "Modul postingan berulang Supplier Wesup." };

export default function RecurringPage() {
  return <SupplierModuleUnavailable title="Postingan berulang belum tersedia" description="Fitur recurring masih menunggu backend generator batch. Tidak ada jadwal demo yang ditampilkan." />;
}