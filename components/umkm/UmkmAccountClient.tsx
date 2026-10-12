"use client";

import Link from "next/link";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ErrorState, AsyncButton } from "@/components/feedback";
import { MapPin, Store, User } from "lucide-react";
import { LogoutAction } from "@/components/auth/LogoutAction";
import { Skeleton } from "@/components/ui/SkeletonLoading";
import { hasValidUmkmLocation } from "@/lib/umkm/profile-completion";

interface UmkmAccountClientProps { fullName: string; email: string; }
interface Profile { businessName: string | null; address: string | null; latitude: number | null; longitude: number | null; }

export default function UmkmAccountClient({ fullName, email }: UmkmAccountClientProps) {
  const { data, loading, error, reload } = useFeedbackResource<{ profile: Profile }>("/api/umkm/profile", "Profil belum dapat dimuat.");
  const profile = data?.profile ?? null;
  const profileComplete = Boolean(profile?.businessName?.trim() && profile?.address?.trim() && hasValidUmkmLocation(profile));
  const locationSaved = hasValidUmkmLocation(profile);
  return (
    <div className="space-y-8 pb-6">
      <section className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center border border-wesup-ink/20 bg-wesup-paper-sub font-landing-display text-2xl uppercase text-wesup-ink" aria-hidden="true">{fullName.trim().slice(0, 1).toUpperCase() || "U"}</span>
          <div className="min-w-0">
            <h2 className="font-landing-display text-xl uppercase tracking-[0.03em] text-wesup-ink">{fullName || "Akun UMKM"}</h2>
            <p className="mt-1 break-all font-mono text-xs text-wesup-ink-sub">{email}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 bg-wesup-paper-sub px-2 py-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-wesup-ink"><User className="size-3" strokeWidth={1.5} aria-hidden="true" />UMKM</span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3" role="status"><Skeleton className="h-32 w-full" /></div>
      ) : error ? (
        <ErrorState title="Profil belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />
      ) : profileComplete ? (
        <section className="border border-wesup-ink/15 bg-wesup-paper">
          <header className="flex items-center justify-between gap-3 border-b border-wesup-ink/10 px-4 py-3 sm:px-5">
            <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Data usaha</h2>
            <Link href="/umkm/onboarding" className="inline-flex min-h-11 items-center border border-wesup-ink/20 bg-wesup-paper px-3 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Edit profil</Link>
          </header>
          <dl className="divide-y divide-wesup-ink/10">
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr]">
              <dt className="px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub sm:px-5">Nama usaha</dt>
              <dd className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-wesup-ink sm:border-l sm:border-wesup-ink/15 sm:px-5"><Store className="size-4 text-wesup-ink-sub" strokeWidth={1.5} aria-hidden="true" />{profile?.businessName}</dd>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr]">
              <dt className="px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub sm:px-5">Alamat</dt>
              <dd className="flex items-start gap-2 px-4 py-3 text-sm leading-6 text-wesup-ink sm:border-l sm:border-wesup-ink/15 sm:px-5"><MapPin className="mt-1 size-4 shrink-0 text-wesup-ink-sub" strokeWidth={1.5} aria-hidden="true" />{profile?.address}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="relative border border-wesup-red bg-wesup-paper p-5 pl-6">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-wesup-red" />
          {locationSaved ? (
            <>
              <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">Lokasi tersimpan, profil usaha belum lengkap</h2>
              <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">Tambahkan nama dan alamat usaha sebelum bergabung ke batch.</p>
            </>
          ) : (
            <>
              <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">Profil usaha belum lengkap</h2>
              <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">Simpan lokasi, nama, dan alamat usaha sebelum bergabung ke batch.</p>
            </>
          )}
          <Link href="/umkm/onboarding" className="mt-4 inline-flex min-h-12 items-center border border-wesup-ink bg-wesup-ink px-6 py-3 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Lengkapi profil</Link>
        </section>
      )}

      <section className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5"><LogoutAction className="inline-flex min-h-11 items-center gap-2 border border-wesup-ink/20 bg-wesup-paper px-4 py-2 text-sm font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red" /></section>
    </div>
  );
}
