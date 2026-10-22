import Link from "next/link";
import { AppPanel } from "@/components/layout/AppPanel";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
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
  const client = await getServerClient();
  const state = await getViewerAccessState(client as unknown as AccessStateClient);
  if (!state) redirect("/login?role=supplier");
  if (state.role !== "supplier" || state.status !== "active" || state.verificationStatus !== "approved") redirect(resolveHomePath(state));

  const owner = await getCurrentUser(client as unknown as AuthClient);
  if (!owner) redirect("/login?role=supplier");
  const [profile, business] = await Promise.all([
    client.from("profiles").select("full_name,phone,created_at").eq("id", owner.userId).single(),
    client.from("supplier_profiles").select("business_name,address,latitude,longitude,verification_status,verified_at").eq("user_id", owner.userId).single(),
  ]);
  const failed = profile.error || business.error || !profile.data || !business.data;
  const date = (value?: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "Belum diisi";
  const groups = [
    ["Identitas pemilik", [["Nama pemilik", profile.data?.full_name], ["Email", owner.email], ["Nomor telepon", profile.data?.phone], ["Bergabung sejak", date(profile.data?.created_at)]]],
    ["Usaha & lokasi", [["Nama usaha", business.data?.business_name], ["Alamat", business.data?.address], ["Koordinat lokasi", business.data?.latitude != null && business.data?.longitude != null ? `${business.data.latitude}, ${business.data.longitude}` : null]]],
    ["Status akses", [["Status akun", "Aktif"], ["Status verifikasi", business.data?.verification_status === "approved" ? "Disetujui" : business.data?.verification_status], ["Tanggal disetujui", date(business.data?.verified_at)]]],
  ] as const;
  return <Layout brandHref={null} footerVariant="brand-only"><PageContainer>
    <PageHeader title="Akun Supplier" description="Identitas, usaha, dan status akses akun Anda." icon={<UserRound aria-hidden="true" className="h-6 w-6" />} />
    {failed ? <AppPanel><section role="alert"><h2 className="font-semibold">Rincian akun belum dapat dimuat.</h2><p className="mt-2 text-sm">Muat ulang untuk memeriksa data akun Anda.</p><form action="/supplier/akun" method="get"><button type="submit" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Muat ulang akun</button></form></section></AppPanel> : <div className="space-y-6">{groups.map(([title, rows]) => <AppPanel key={title}><section aria-label={title}><h2 className="font-landing-display text-xl uppercase text-wesup-ink">{title}</h2><dl className="mt-4 divide-y divide-wesup-ink/10 border-y border-wesup-ink/10">{rows.map(([label, value]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-[12rem_1fr]"><dt className="font-mono text-xs uppercase tracking-wider text-wesup-ink-sub">{label}</dt><dd className="min-w-0 break-words text-sm font-semibold tabular-nums">{value || "Belum diisi"}</dd></div>)}</dl></section></AppPanel>)}</div>}
    <nav aria-label="Pengaturan keuangan" className="mt-6 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center border border-wesup-ink px-4 py-2 text-sm font-semibold focus-visible:outline-wesup-red" href="/supplier/akun/rekening">Kelola rekening</Link><Link className="inline-flex min-h-11 items-center bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper focus-visible:outline-wesup-red" href="/supplier/keuangan">Lihat keuangan</Link></nav>
  </PageContainer></Layout>;

}
