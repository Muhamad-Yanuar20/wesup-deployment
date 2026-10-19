import type { Metadata } from "next";
import SupplierFinanceClient from "@/components/supplier/finance/SupplierFinanceClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rekening Supplier | Wesup", description: "Modul rekening Supplier Wesup." };

export default function SupplierDisbursementPage() {
  return <SupplierFinanceClient view="bank-account" />;
}
