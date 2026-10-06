"use client";

import Link from "next/link";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ErrorState, ContentSkeleton, AsyncButton } from "@/components/feedback";
import { ArrowRight, Bell, CircleAlert, ClipboardList, MapPin, Store } from "lucide-react";

interface DashboardData {
  profileComplete: boolean;
  profile: { businessName: string; address: string } | null;
  activeOrderCount: number;
  unreadNotificationCount: number;
  nextAction: { type: "payment" | "pickup"; registrationId: string; batchId: string; batchTitle: string; dueAt: string | null } | null;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

function formatDueAt(value: string | null): string {
  if (!value) return "Tenggat belum tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tenggat belum tersedia" : dateFormatter.format(date);
}

export default function UmkmDashboardClient() {
  const { data, loading, error, reload } = useFeedbackResource<DashboardData>("/api/umkm/dashboard", "Dashboard belum dapat dimuat.");
  if (!data && loading) return <ContentSkeleton label="Memuat dashboard…" />;
  if (!data) return <ErrorState title="Dashboard belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />;

  return (
    <div className="space-y-5 sm:space-y-6">
      {!data.profileComplete ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" /><div><h2 className="font-bold text-amber-950">Profil usaha belum lengkap</h2><p className="mt-1 text-sm leading-6 text-amber-900">Lengkapi nama, alamat, dan pin lokasi agar bisa bergabung ke batch.</p></div></div>
          <Link href="/umkm/onboarding" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2">Lengkapi profil<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm sm:p-5"><p className="text-sm font-semibold text-blue-800">Profil usaha aktif</p><p className="mt-1 text-lg font-bold text-blue-950">{data.profile?.businessName || "Usaha Anda"}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-blue-800"><MapPin className="h-4 w-4" aria-hidden="true" />{data.profile?.address || "Alamat tersimpan"}</p></section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Ringkasan aktivitas">
        <SummaryCard icon={<ClipboardList className="h-5 w-5 text-blue-700" aria-hidden="true" />} label="Pesanan aktif" value={String(data.activeOrderCount)} />
        <SummaryCard icon={<Bell className="h-5 w-5 text-amber-700" aria-hidden="true" />} label="Notifikasi belum dibaca" value={String(data.unreadNotificationCount)} />
        <SummaryCard icon={<Store className="h-5 w-5 text-emerald-700" aria-hidden="true" />} label="Akses marketplace" value="Terbuka" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-slate-900">Tindakan terdekat</h2><Link href="/umkm/pesanan" className="text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Lihat pesanan</Link></div>
        {data.nextAction ? <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-900">{data.nextAction.type === "payment" ? "Bayar" : "Siapkan pengambilan"} {data.nextAction.batchTitle}</p><p className="mt-1 text-sm text-slate-600">{data.nextAction.type === "payment" ? "Jendela pembayaran" : "Estimasi barang siap"}: {formatDueAt(data.nextAction.dueAt)}</p></div> : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Belum ada tindakan yang perlu dilakukan. Jelajahi batch yang tersedia.</p>}
      </section>

      <Link href="/marketplace" className="group flex min-h-24 items-center justify-between rounded-2xl bg-blue-700 p-4 text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><div><p className="text-lg font-bold">Cari bahan baku bersama</p><p className="mt-1 text-sm text-blue-100">Lihat batch publik tanpa langkah tambahan.</p></div><ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden="true" /></Link>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">{icon}</span><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div></div></div>;
}
