import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Store, UserRound } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard UMKM | Wesup",
  description: "Pusat aktivitas UMKM di Wesup.",
};

export default function UmkmPage() {
  return (
    <Layout>
      <PageContainer>
        <PageHeader title="Dashboard UMKM" description="Kelola belanja bahan baku dan aktivitas usaha Anda di Wesup." icon={<Store aria-hidden="true" className="h-6 w-6" />} />
        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/marketplace" className="group rounded-2xl border border-blue-100 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Store className="h-7 w-7 text-blue-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-bold text-slate-900">Jelajahi Marketplace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Lihat batch publik dan pilih bahan baku dengan harga bertingkat.</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Lihat batch <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
          <Link href="/umkm/akun" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <UserRound className="h-7 w-7 text-slate-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-bold text-slate-900">Lengkapi akun usaha</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Profil usaha diperlukan saat Anda ingin Join Batch.</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Buka akun <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        </section>
      </PageContainer>
    </Layout>
  );
}
