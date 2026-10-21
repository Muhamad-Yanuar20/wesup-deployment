import SupplierBatchTransactionCenter from "@/components/supplier-batch/SupplierBatchTransactionCenter";
import SupplierBatchProductDisclosure from "@/components/supplier-batch/SupplierBatchProductDisclosure";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <SupplierBatchTransactionCenter key={id} batchId={id} />
      <SupplierBatchProductDisclosure key={`product:${id}`} batchId={id} />
    </div>
  );
}
