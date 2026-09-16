import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bayar Tagihan | Wesup",
  description: "Selesaikan pembayaran tagihan QRIS di dalam Payment Window.",
};

export default async function PaymentWindowPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <Layout>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <UmkmOrderDetailClient orderId={orderId} mode="payment" />
      </div>
    </Layout>
  );
}
