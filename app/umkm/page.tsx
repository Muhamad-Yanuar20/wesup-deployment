import type { Metadata } from "next";
import { Store } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import UmkmDashboardClient from "@/components/umkm/UmkmDashboardClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard UMKM | Wesup", description: "Pusat aktivitas UMKM di Wesup." };

export default function UmkmPage() {
  return <Layout><PageContainer><PageHeader title="Dashboard UMKM" description="Kelola belanja bahan baku dan aktivitas usaha Anda di Wesup." icon={<Store aria-hidden="true" className="h-6 w-6" />} /><UmkmDashboardClient /></PageContainer></Layout>;
}