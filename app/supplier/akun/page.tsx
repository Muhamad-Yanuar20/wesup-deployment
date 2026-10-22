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
    <Layout brandHref={null}>
      <PageContainer>
        <PageHeader title="Akun Supplier" description="Profil dan akses operasional Supplier Anda." icon={<UserRound aria-hidden="true" className="h-6 w-6" />} />
        <section className="border border-wesup-ink/15 bg-wesup-paper">
          <header className="flex items-center gap-2 border-b border-wesup-ink/10 px-4 py-3 sm:px-5">
            <span aria-hidden="true" className="h-px w-6 bg-wesup-red" />
            <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Status akses</h2>
          </header>
          <div className="p-4 sm:p-5">
            <p className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">Akses Supplier aktif</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-wesup-ink-sub">Akun Anda sudah disetujui dan dapat mengelola katalog serta batch yang dimiliki. Pengaturan rekening dan modul pelaporan akan muncul setelah backend operasionalnya tersedia.</p>
          </div>
        </section>
      </PageContainer>
    </Layout>
  );
}
