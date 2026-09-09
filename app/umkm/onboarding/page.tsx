import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { sanitizeReturnTo } from "@/lib/auth/access-state";
import UmkmOnboardingForm from "@/components/umkm/UmkmOnboardingForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil Usaha UMKM | Wesup",
  description: "Lengkapi profil usaha sebelum bergabung ke batch pembelian Wesup.",
};

interface OnboardingPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UmkmOnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = searchParams ? await searchParams : {};
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo, "umkm");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link href="/umkm" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke Dashboard
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-700">
            <Store className="h-4 w-4" aria-hidden="true" /> Wesup UMKM
          </span>
        </header>

        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Onboarding</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Profil usaha Anda</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Lengkapi sekali agar proses bergabung ke batch lebih cepat. Anda tetap dapat melihat marketplace tanpa melengkapi profil.</p>
        </div>

        <UmkmOnboardingForm returnTo={returnTo} />
      </div>
    </main>
  );
}
