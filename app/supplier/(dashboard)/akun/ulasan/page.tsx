import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Penilaian Supplier | Wesup", description: "Modul penilaian Supplier Wesup." };

export default function SupplierReviewsPage() {
  return <SupplierModuleUnavailable title="Penilaian Supplier belum tersedia" description="Ringkasan rating di dashboard memakai data transaksi nyata. Detail ulasan akan dibuka setelah endpoint ulasan Supplier tersedia." />;
}