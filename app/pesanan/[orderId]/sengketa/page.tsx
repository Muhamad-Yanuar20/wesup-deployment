import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lacak Sengketa | Wesup",
  description:
    "Pantau status sengketa escrow, dana yang dibekukan, dan keputusan Arbiter di Wesup.",
};

export default async function ComplaintStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <Layout brandHref={null}>
      <div className="bg-wesup-paper px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <UmkmOrderDetailClient orderId={orderId} mode="dispute" />
      </div>
    </Layout>
  );
}
