import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import RegistrationRoleChooser from "@/components/auth/RegistrationRoleChooser";
import { getViewerAccessState, resolveHomePath } from "@/lib/auth/access-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar | Wesup",
  description: "Pilih role akun UMKM atau Supplier untuk mulai menggunakan Wesup.",
};

export default async function RegisterPage() {
  const accessState = await getViewerAccessState();
  if (accessState) redirect(resolveHomePath(accessState));

  return (
    <main className="wesup-app min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_38%),linear-gradient(180deg,_#f8fafc,_#eff6ff)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4 sm:mb-12">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl text-slate-900 transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Wesup - Kembali ke beranda"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-sm shadow-blue-600/20" aria-hidden="true">
              W
            </span>
            <span className="text-lg font-extrabold tracking-tight">Wesup</span>
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Lihat Marketplace
          </Link>
        </header>

        <RegistrationRoleChooser />
      </div>
    </main>
  );
}
