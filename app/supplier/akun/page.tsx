import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound, WalletCards } from "lucide-react";
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
  return <Layout><PageContainer><PageHeader title="Akun Supplier" description="Profil Supplier dan pengaturan operasional Anda." icon={<UserRound aria-hidden="true" className="h-6 w-6" />} /><div className="grid gap-4 sm:grid-cols-2"><Link href="/supplier/akun/rekening" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><WalletCards className="h-6 w-6 text-blue-600" aria-hidden="true" /><h2 className="mt-3 font-bold text-slate-900">Rekening Supplier</h2><p className="mt-1 text-sm text-slate-600">Kelola rekening pencairan dana.</p></Link></div></PageContainer></Layout>;
}
