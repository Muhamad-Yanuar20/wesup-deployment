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
    <div className="space-y-5 sm:space-y-6 pb-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">{fullName.trim().slice(0, 1).toUpperCase() || "U"}</span><div><h2 className="text-xl font-bold text-slate-900">{fullName || "Akun UMKM"}</h2><p className="mt-1 text-sm text-slate-500">{email}</p><span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"><User className="h-3 w-3" aria-hidden="true" /> UMKM</span></div></div></section>
      {loading ? <div className="space-y-3" role="status"><Skeleton className="h-32 w-full rounded-xl" /></div> : error ? <ErrorState title="Profil belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} /> : profileComplete ? <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Store className="h-5 w-5 text-blue-700" aria-hidden="true" />{profile?.businessName}</h2><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600"><MapPin className="mt-1 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />{profile?.address}</p></div><Link href="/umkm/onboarding" className="inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Edit profil</Link></div></section> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">{locationSaved ? <><h2 className="font-bold text-amber-950">Lokasi tersimpan, profil usaha belum lengkap</h2><p className="mt-1 text-sm leading-6 text-amber-900">Tambahkan nama dan alamat usaha sebelum bergabung ke batch.</p></> : <><h2 className="font-bold text-amber-950">Profil usaha belum lengkap</h2><p className="mt-1 text-sm leading-6 text-amber-900">Simpan lokasi, nama, dan alamat usaha sebelum bergabung ke batch.</p></>}<Link href="/umkm/onboarding" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2">Lengkapi profil</Link></section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><LogoutAction /></section>
    </div>
  );
}