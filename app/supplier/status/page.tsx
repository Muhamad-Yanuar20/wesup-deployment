import type { Metadata } from "next";
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
  const toneClasses = {
    pending: "border-wesup-ink/15 bg-wesup-paper text-wesup-ink",
    rejected: "border-wesup-red bg-wesup-paper text-wesup-ink",
    approved: "border-wesup-ink/15 bg-wesup-paper text-wesup-ink",
  } as const;

  return (
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-10 text-wesup-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header>
          <Link href="/" className="text-sm font-semibold text-wesup-ink-sub hover:text-wesup-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">
            Wesup
          </Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-wesup-ink-sub">Status Supplier</p>
          <h1 className="mt-2 text-3xl tracking-tight text-wesup-ink sm:text-4xl font-landing-display font-normal uppercase tracking-[0.04em]">{view.title}</h1>
          <p className="mt-3 text-base leading-7 text-wesup-ink-sub">{businessName}</p>
        </header>

        <section className={` border p-6  sm:p-8 ${toneClasses[view.tone]}`} aria-live="polite">
          <p className="text-base leading-7">{view.description}</p>
          {view.reason && (
            <div className="mt-5 border border-wesup-red bg-wesup-paper p-4">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-wesup-ink">Catatan Admin</p>
              <p className="mt-2 text-sm leading-6">{view.reason}</p>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/marketplace" className="inline-flex min-h-11 flex-1 items-center justify-center bg-wesup-ink px-5 py-3 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">
            Lihat Marketplace
          </Link>
          <Link href="/" className="inline-flex min-h-11 flex-1 items-center justify-center border border-wesup-ink/15 bg-wesup-paper px-5 py-3 text-sm font-semibold text-wesup-ink-sub transition-colors duration-500 wesup-ease hover:border-wesup-ink/20 hover:bg-wesup-paper hover:text-wesup-ink-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">
            Kembali ke Beranda
          </Link>
        </div>

        {view.readOnly && (
          <p className="text-center text-sm leading-6 text-wesup-ink-sub">Dashboard, katalog, rekening, dan pengambilan tersedia setelah verifikasi Supplier disetujui.</p>
        )}
      </div>
    </main>
  );
}
