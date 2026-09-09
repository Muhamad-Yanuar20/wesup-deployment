import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";
import { Layout } from "@/components/layout/Layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Akun Supplier | Wesup", description: "Kelola akun Supplier Wesup." };

export default async function SupplierAccountPage() {
  const state = await getViewerAccessState((await getServerClient()) as unknown as AccessStateClient);
  if (!state) redirect("/login?role=supplier");
  if (state.role !== "supplier" || state.status !== "active" || state.verificationStatus !== "approved") redirect(resolveHomePath(state));
  return (
    <Layout>
      <PageContainer>
        <PageHeader title="Akun Supplier" description="Profil dan akses operasional Supplier Anda." icon={<UserRound aria-hidden="true" className="h-6 w-6" />} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Akses Supplier aktif</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Akun Anda sudah disetujui dan dapat mengelola katalog serta batch yang dimiliki. Pengaturan rekening dan modul pelaporan akan muncul setelah backend operasionalnya tersedia.</p>
        </section>
      </PageContainer>
    </Layout>
  );
}