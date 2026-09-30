import type { Metadata } from "next";
import SupplierFinanceClient from "@/components/supplier/finance/SupplierFinanceClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Keuangan Supplier | Wesup", description: "Saldo escrow dan pencairan Supplier." };

export default function SupplierFinancePage() {
  return <SupplierFinanceClient />;
}
