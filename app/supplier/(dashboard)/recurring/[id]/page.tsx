import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detail Postingan Berulang | Wesup", description: "Modul postingan berulang Supplier Wesup." };

export default function RecurringDetailPage() {
  return <SupplierModuleUnavailable title="Detail postingan berulang belum tersedia" description="Detail jadwal recurring belum dibuka karena backend generator batch belum tersedia." />;
}