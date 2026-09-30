import type { Metadata } from "next";
import SupplierFinanceClient from "@/components/supplier/finance/SupplierFinanceClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Monitoring Escrow | Wesup", description: "Modul monitoring escrow Supplier Wesup." };

export default function SupplierEscrowPage() {
  return <SupplierFinanceClient />;
}
