import "leaflet/dist/leaflet.css";
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
    <main className="min-h-screen bg-wesup-paper px-4 py-6 pb-10 text-wesup-ink sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-7 flex items-center justify-between gap-3 border border-wesup-ink/15 bg-wesup-paper p-3">
          <Link href="/umkm" className="inline-flex min-h-11 items-center gap-2 px-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Kembali ke Dashboard
          </Link>
          <span className="inline-flex items-center gap-2 font-landing-display text-sm uppercase tracking-[0.06em] text-wesup-ink">
            <Store className="size-4 text-wesup-red" strokeWidth={1.5} aria-hidden="true" /> Wesup UMKM
          </span>
        </header>

        <div className="mb-7">
          <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-wesup-ink-sub"><span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />Onboarding</p>
          <h1 className="mt-4 font-landing-display text-3xl uppercase leading-[0.95] tracking-[0.06em] text-wesup-ink sm:text-4xl">Profil usaha Anda</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-wesup-ink-sub">Lengkapi sekali agar proses bergabung ke batch lebih cepat. Anda tetap dapat melihat marketplace tanpa melengkapi profil.</p>
        </div>

        <UmkmOnboardingForm returnTo={returnTo} />
      </div>
    </main>
  );
}
