import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AppPanel } from "@/components/layout/AppPanel";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getSupplierStatusView } from "@/lib/supplier-registration/status";
import { getServerClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status Pendaftaran Supplier | Wesup",
  description: "Lihat status verifikasi pendaftaran Supplier Wesup.",
};

export default async function SupplierStatusPage() {
  const client = await getServerClient();
  const accessState = await getViewerAccessState(client as unknown as AccessStateClient);

  if (!accessState) {
    redirect("/login?role=supplier&returnTo=/supplier/status");
  }
  if (accessState.role !== "supplier") {
    redirect(resolveHomePath(accessState));
  }
  if (accessState.status !== "active") {
    redirect("/login?role=supplier&returnTo=/supplier/status");
  }

  const { data: authData } = await client.auth.getUser();
  if (!authData.user) {
    redirect("/login?role=supplier&returnTo=/supplier/status");
  }

  const { data: supplierProfile } = await client
    .from("supplier_profiles")
    .select("business_name,verification_status,verification_notes")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const profile = supplierProfile as {
    business_name?: string | null;
    verification_status?: VerificationStatus;
    verification_notes?: string | null;
  } | null;
  const status = profile?.verification_status ?? accessState.verificationStatus;

  if (status === "approved") {
    redirect("/supplier");
  }

  const view = getSupplierStatusView(status, profile?.verification_notes);
  const businessName = profile?.business_name?.trim() || "akun Supplier Anda";
  return (
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-10 text-wesup-ink sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <AuthHeader title={view.title} eyebrow="Pendaftaran / Status Supplier" description={businessName} />
        <AppPanel>
          <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section aria-live="polite">
              <p className={`mb-5 inline-flex border-l-2 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] ${view.tone === "rejected" ? "border-wesup-red bg-wesup-paper-sub" : "border-wesup-ink bg-wesup-paper-sub"}`}>{view.tone === "rejected" ? "Perlu ditinjau kembali" : "Menunggu verifikasi"}</p>
              <p className="text-base leading-8 text-wesup-ink-sub">{view.description}</p>
              {view.reason && <div className="mt-6 border-l-2 border-wesup-red bg-wesup-paper-sub p-5"><h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.18em]">Catatan Admin</h2><p className="mt-3 text-sm leading-7">{view.reason}</p></div>}
            </section>
            <aside className="border-t border-wesup-ink/15 pt-6 md:border-l md:border-t-0 md:pl-7 md:pt-0">
              <h2 className="font-landing-display text-xl uppercase tracking-[0.04em]">Langkah berikutnya</h2>
              <p className="mt-4 text-sm leading-7 text-wesup-ink-sub">Pantau halaman ini untuk hasil pemeriksaan data usaha Anda. Anda dapat menjelajahi penawaran sambil menunggu.</p>
              <Link href="/marketplace" className="group mt-6 flex min-h-12 items-center justify-between gap-4 border border-wesup-ink bg-wesup-ink py-2 pl-5 pr-2 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red">Lihat Marketplace<span className="flex size-8 items-center justify-center border border-wesup-paper/25 transition-transform duration-500 wesup-ease group-hover:translate-x-0.5"><ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" /></span></Link>
              <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-wesup-ink/30 underline-offset-4">Kembali ke Beranda</Link>
            </aside>
          </div>
        </AppPanel>
        {view.readOnly && <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-7 text-wesup-ink-sub">Dashboard, katalog, rekening, dan pengambilan tersedia setelah verifikasi Supplier disetujui.</p>}
      </div>
    </main>
  );
}
