import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { marketplaceMockItems } from "@/lib/marketplace/mock-data";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";

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

  const viewer = await getCurrentUser((await getServerClient()) as unknown as AuthClient);
  const viewerRole = viewer?.role ?? null;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          Kembali ke Marketplace
        </Link>
        <div className="mt-4">
          <MarketplaceDetailClient item={item} viewerRole={viewerRole} />
        </div>
      </div>
    </Layout>
  );
}