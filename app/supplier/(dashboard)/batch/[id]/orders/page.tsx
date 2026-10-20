import type { Metadata } from "next";
import OrderListClient from "@/components/supplier/fulfillment/OrderListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manajemen Pesanan | Wesup",
  description: "Kelola daftar UMKM yang akan mengambil barang pada batch Anda di Wesup.",
};

export default async function SupplierBatchOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <OrderListClient key={id} batchId={id} />
    </div>
  );
}
