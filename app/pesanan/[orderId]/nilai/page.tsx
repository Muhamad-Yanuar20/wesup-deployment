import type { Metadata } from "next";
import { Layout } from "@/components/layout/Layout";
import UmkmOrderDetailClient from "@/components/umkm/UmkmOrderDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nilai & Ulas | Wesup",
  description:
    "Berikan penilaian bintang dan ulasan untuk kualitas pelayanan Supplier di Wesup.",
};

export default async function RatingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <Layout>
      <div className="bg-wesup-paper px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <UmkmOrderDetailClient orderId={orderId} mode="rating" />
      </div>
    </Layout>
  );
}
