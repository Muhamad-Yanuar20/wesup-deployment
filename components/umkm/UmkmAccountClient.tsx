"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, MapPin, Store, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/SkeletonLoading";

interface UmkmAccountClientProps { fullName: string; email: string; }
interface Profile { businessName: string; address: string; latitude: number; longitude: number; }

export default function UmkmAccountClient({ fullName, email }: UmkmAccountClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => { let cancelled = false; void fetch("/api/umkm/profile", { cache: "no-store" }).then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "Profil belum dapat dimuat."); if (!cancelled) setProfile(body.profile); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Profil belum dapat dimuat."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const signOut = async () => { setSigningOut(true); await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined); router.push("/"); router.refresh(); };
  return <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">{fullName.trim().slice(0, 1).toUpperCase() || "U"}</span><div><h2 className="text-xl font-bold text-slate-900">{fullName || "Akun UMKM"}</h2><p className="mt-1 text-sm text-slate-500">{email}</p><span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"><User className="h-3 w-3" aria-hidden="true" /> UMKM</span></div></div></section>{loading ? <div className="space-y-3" role="status"><Skeleton className="h-32 w-full rounded-xl" /></div> : error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : profile ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Store className="h-5 w-5 text-blue-700" aria-hidden="true" />{profile.businessName}</h2><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600"><MapPin className="mt-1 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />{profile.address}</p></div><Link href="/umkm/onboarding" className="inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Edit profil</Link></div></section> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Profil usaha belum lengkap</h2><p className="mt-1 text-sm leading-6 text-amber-900">Lengkapi data usaha sebelum ingin bergabung ke batch.</p><Link href="/umkm/onboarding" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800">Lengkapi profil</Link></section>}<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><button type="button" onClick={() => void signOut()} disabled={signingOut} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"><LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? "Keluar..." : "Keluar"}</button></section></div>;
}
