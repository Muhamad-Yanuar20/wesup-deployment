import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { marketplaceMockItems } from "@/lib/marketplace/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detail Penawaran | Wesup",
  description: "Lihat detail penawaran produk UMKM di marketplace Wesup.",
};

export default async function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = marketplaceMockItems.find((candidate) => candidate.slug === slug) ?? marketplaceMockItems[0];

  if (!item) {
    notFound();
  }

  return <MarketplaceDetailClient item={item} />;
}
