import type { Metadata } from "next";
import { headers } from "next/headers";
import { Layout } from "@/components/layout/Layout";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";
import type { MidtransSnapConfig } from "@/components/payments/MidtransSnapLoader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bayar Tagihan | Wesup",
  description: "Selesaikan pembayaran tagihan melalui checkout Midtrans di dalam Payment Window.",
};

export default async function PaymentWindowPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const requestHeaders = await headers();
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const snapConfig: MidtransSnapConfig = {
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
    scriptUrl: `${isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com"}/snap/snap.js`,
    nonce: requestHeaders.get("x-nonce"),
  };

  return (
    <Layout brandHref={null}>
      <div className="bg-wesup-paper px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <UmkmOrderDetailClient orderId={orderId} mode="payment" snapConfig={snapConfig} />
      </div>
    </Layout>
  );
}
