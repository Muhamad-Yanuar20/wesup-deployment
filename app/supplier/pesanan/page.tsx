import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";
import { Layout } from "@/components/layout/Layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import SupplierOrdersOverviewClient from "@/components/supplier/SupplierOrdersOverviewClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pesanan Supplier | Wesup", description: "Pilih batch untuk mengelola pesanan dan pengambilan Supplier." };

export default async function SupplierOrdersPage() {
  const state = await getViewerAccessState((await getServerClient()) as unknown as AccessStateClient);
  if (!state) redirect("/login?role=supplier&returnTo=/supplier/pesanan");
  if (state.role !== "supplier" || state.status !== "active" || state.verificationStatus !== "approved") redirect(resolveHomePath(state));
  return <Layout brandHref={null}><PageContainer><PageHeader title="Pesanan & Pengambilan" description="Pilih batch untuk melihat pesanan UMKM dan memproses serah terima." icon={<ClipboardList aria-hidden="true" className="h-6 w-6" />} /><SupplierOrdersOverviewClient /></PageContainer></Layout>;
}