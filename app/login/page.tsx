import type { Metadata } from "next";
import Link from "next/link";
import { sanitizeReturnTo } from "@/lib/auth/access-state";
import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk | Wesup",
  description: "Masuk ke akun Wesup sebagai UMKM atau Supplier.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const initialRole = rawRole === "supplier" ? "supplier" : "umkm";
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo, initialRole);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_38%),linear-gradient(180deg,_#f8fafc,_#eff6ff)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <Link href="/" className="inline-flex items-center gap-2 text-slate-900 transition hover:opacity-80" aria-label="Wesup - Kembali ke beranda">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-sm shadow-blue-600/20" aria-hidden="true">W</span>
              <span className="text-lg font-extrabold tracking-tight">Wesup</span>
            </Link>
            <p className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 shadow-sm">Selamat datang kembali</p>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Masuk ke akun Anda</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-600">Pilih role akun UMKM atau Supplier untuk melanjutkan aktivitas di Wesup.</p>
        </header>

        <div className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-xl shadow-blue-950/5 sm:p-9">
          <LoginForm initialRole={initialRole} returnTo={returnTo} />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-blue-700 underline-offset-4 hover:underline">Kembali ke beranda</Link>
          <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
          <Link href="/admin/login" className="font-semibold text-slate-600 underline-offset-4 hover:underline">Login Admin</Link>
        </p>
      </div>
    </main>
  );
}