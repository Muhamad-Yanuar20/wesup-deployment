import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import UmkmSignupForm from "@/components/auth/UmkmSignupForm";
import { getViewerAccessState, resolveHomePath, sanitizeReturnTo } from "@/lib/auth/access-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar sebagai UMKM | Wesup",
  description: "Buat akun UMKM untuk bergabung dalam pembelian bahan baku bersama.",
};

export default async function UmkmRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const accessState = await getViewerAccessState();
  if (accessState) redirect(resolveHomePath(accessState));

  const params = await searchParams;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo, "umkm");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_38%),linear-gradient(180deg,_#f8fafc,_#eff6ff)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-8 text-center sm:mb-10">
          <Link href="/register" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            ← Pilih role lain
          </Link>
          <span className="mt-6 inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
            Akun UMKM
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Mulai belanja bersama</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-600">Buat akun singkat sekarang. Profil usaha dan lokasi pickup bisa Anda lengkapi saat ingin bergabung batch.</p>
        </header>

        <div className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-xl shadow-blue-950/5 sm:p-9">
          <UmkmSignupForm returnTo={returnTo} />
        </div>
      </div>
    </main>
  );
}
