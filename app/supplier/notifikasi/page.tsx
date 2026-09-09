import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import SupplierNotificationsClient from "@/components/supplier/SupplierNotificationsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifikasi Supplier | Wesup", description: "Pusat notifikasi Supplier Wesup." };

export default async function SupplierNotificationsPage() {
  const state = await getViewerAccessState((await getServerClient()) as unknown as AccessStateClient);
  if (!state) redirect("/login?role=supplier");
  if (state.role !== "supplier" || state.status !== "active" || state.verificationStatus !== "approved") redirect(resolveHomePath(state));
  return <Layout><PageContainer><PageHeader title="Notifikasi" description="Pembaruan katalog, pesanan, dan aktivitas Supplier." icon={<Bell aria-hidden="true" className="h-6 w-6" />} /><SupplierNotificationsClient /></PageContainer></Layout>;
}
