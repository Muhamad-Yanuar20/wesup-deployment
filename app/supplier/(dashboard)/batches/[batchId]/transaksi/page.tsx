import type { Metadata } from "next";
import SupplierBatchTransactionCenter from "@/components/supplier-batch/SupplierBatchTransactionCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transaksi Batch | Wesup", description: "Kelola transaksi UMKM pada batch Supplier." };

export default async function SupplierBatchTransactionsPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-6xl"><SupplierBatchTransactionCenter batchId={batchId} /></div></main>;
}
