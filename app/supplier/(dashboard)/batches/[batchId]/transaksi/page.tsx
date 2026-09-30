import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transaksi Batch | Wesup", description: "Kelola transaksi UMKM pada batch Supplier." };

export default async function SupplierBatchTransactionsPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  redirect(`/supplier/batch/${batchId}`);
}
