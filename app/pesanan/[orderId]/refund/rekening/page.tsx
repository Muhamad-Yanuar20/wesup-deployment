import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rekening Refund | Wesup",
  description:
    "Isi rekening manual untuk pengembalian dana penuh setelah sengketa dimenangkan di Wesup.",
};

export default async function RefundAccountPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <Layout>
      <div className="bg-wesup-paper px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <UmkmOrderDetailClient orderId={orderId} mode="refund" />
      </div>
    </Layout>
  );
}
