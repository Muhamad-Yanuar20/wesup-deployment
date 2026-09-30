import SupplierBatchTransactionCenter from "@/components/supplier-batch/SupplierBatchTransactionCenter";
import SupplierBatchDetailClient from "@/components/supplier-batch/SupplierBatchDetailClient";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6"><SupplierBatchTransactionCenter key={id} batchId={id}/><details><summary className="cursor-pointer rounded-xl border bg-white p-4 font-semibold">Detail produk dan pengaturan penawaran</summary><SupplierBatchDetailClient batchId={id}/></details></main>;
}
