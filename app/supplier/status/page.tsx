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
    pending: "border-amber-200 bg-amber-50 text-amber-900",
    rejected: "border-red-200 bg-red-50 text-red-900",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header>
          <Link href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Wesup
          </Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Status Supplier</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{view.title}</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{businessName}</p>
        </header>

        <section className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${toneClasses[view.tone]}`} aria-live="polite">
          <p className="text-base leading-7">{view.description}</p>
          {view.reason && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Catatan Admin</p>
              <p className="mt-2 text-sm leading-6">{view.reason}</p>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/marketplace" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Lihat Marketplace
          </Link>
          <Link href="/" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Kembali ke Beranda
          </Link>
        </div>

        {view.readOnly && (
          <p className="text-center text-sm leading-6 text-slate-500">Dashboard, katalog, rekening, dan pengambilan tersedia setelah verifikasi Supplier disetujui.</p>
        )}
      </div>
    </main>
  );
}
