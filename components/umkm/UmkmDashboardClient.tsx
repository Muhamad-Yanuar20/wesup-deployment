"use client";

import Link from "next/link";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ErrorState, ContentSkeleton, AsyncButton, ArrowDisc } from "@/components/feedback";
import { ArrowRight, CircleAlert, MapPin } from "lucide-react";

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
    <div className="space-y-8">
      {!data.profileComplete ? (
        <section className="relative flex flex-col gap-4 border border-wesup-red bg-wesup-paper p-4 pl-5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-wesup-red" />
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-wesup-red" strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">Profil usaha belum lengkap</h2>
              <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">Lengkapi nama, alamat, dan pin lokasi agar bisa bergabung ke batch.</p>
            </div>
          </div>
          <Link href="/umkm/onboarding" className="group inline-flex min-h-12 items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-6 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Lengkapi profil<ArrowDisc /></Link>
        </section>
      ) : (
        <section className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Profil usaha aktif</p>
          <p className="mt-2 font-landing-display text-xl uppercase tracking-[0.04em] text-wesup-ink">{data.profile?.businessName || "Usaha Anda"}</p>
          <p className="mt-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink-sub"><MapPin className="size-4" strokeWidth={1.5} aria-hidden="true" />{data.profile?.address || "Alamat tersimpan"}</p>
        </section>
      )}

      <section aria-label="Ringkasan aktivitas" className="grid grid-cols-2 gap-px border border-wesup-ink/10 bg-wesup-ink/10 sm:grid-cols-3">
        <SummaryCell label="Pesanan aktif" value={String(data.activeOrderCount)} />
        <SummaryCell label="Notifikasi belum dibaca" value={String(data.unreadNotificationCount)} />
        <SummaryCell label="Akses marketplace" value="Terbuka" />
      </section>

      <section className="border border-wesup-ink/15 bg-wesup-paper">
        <header className="flex items-center justify-between gap-3 border-b border-wesup-ink/10 px-4 py-3 sm:px-5">
          <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Tindakan terdekat</h2>
          <Link href="/umkm/pesanan" className="inline-flex min-h-11 items-center text-sm font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Lihat pesanan</Link>
        </header>
        {data.nextAction ? (
          <div className="p-4 sm:p-5">
            <p className="font-landing-display text-lg uppercase tracking-[0.04em] text-wesup-ink">{data.nextAction.type === "payment" ? "Bayar" : "Siapkan pengambilan"} {data.nextAction.batchTitle}</p>
            <dl className="mt-4 grid grid-cols-2 gap-px border border-wesup-ink/10 bg-wesup-ink/10">
              <div className="bg-wesup-paper px-3 py-2">
                <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{data.nextAction.type === "payment" ? "Jendela pembayaran" : "Estimasi barang siap"}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-wesup-ink">{formatDueAt(data.nextAction.dueAt)}</dd>
              </div>
              <div className="bg-wesup-paper px-3 py-2">
                <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Status aksi</dt>
                <dd className="mt-1 text-sm font-semibold text-wesup-ink">{data.nextAction.type === "payment" ? "Perlu dibayar" : "Perlu diambil"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="border-b-0 p-5 text-sm leading-6 text-wesup-ink-sub">Belum ada tindakan yang perlu dilakukan. Jelajahi batch yang tersedia.</p>
        )}
      </section>

      <Link href="/marketplace" className="group flex min-h-24 items-center justify-between border border-wesup-ink bg-wesup-ink p-5 text-wesup-paper transition-all duration-500 wesup-ease hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">
        <div>
          <p className="font-landing-display text-xl uppercase tracking-[0.04em]">Cari bahan baku bersama</p>
          <p className="mt-1.5 text-sm text-wesup-paper/70">Lihat batch publik tanpa langkah tambahan.</p>
        </div>
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center border border-wesup-paper/30 transition-transform duration-500 wesup-ease group-hover:translate-x-1"><ArrowRight className="size-4" strokeWidth={1.5} /></span>
      </Link>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-wesup-paper p-4 sm:p-5">
      <span aria-hidden="true" className="mb-3 block h-px w-8 bg-wesup-red" />
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{label}</p>
      <p className="mt-2 font-landing-display text-3xl uppercase tabular-nums tracking-[0.02em] text-wesup-ink">{value}</p>
    </div>
  );
}
