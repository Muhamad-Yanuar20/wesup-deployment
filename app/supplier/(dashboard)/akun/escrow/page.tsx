import type { Metadata } from "next";
import SupplierModuleUnavailable from "@/components/supplier/SupplierModuleUnavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Monitoring Escrow | Wesup", description: "Modul monitoring escrow Supplier Wesup." };

export default function SupplierEscrowPage() {
  return <SupplierModuleUnavailable title="Monitoring escrow belum tersedia" description="Status escrow akan ditampilkan setelah API pencairan dana tersedia. Wesup tidak menampilkan data escrow demo." />;
}