
import { BrandLogo } from "@/components/brand/BrandLogo";
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
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-8 sm:px-6 sm:py-12 lg:px-8 text-wesup-ink">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4 sm:mb-12">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-wesup-ink transition-colors duration-500 wesup-ease hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
            aria-label="Wesup - Kembali ke beranda"
          >
            <BrandLogo />
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-wesup-ink-sub transition-colors duration-500 wesup-ease hover:bg-wesup-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
          >
            Lihat Marketplace
          </Link>
        </header>

        <RegistrationRoleChooser />
      </div>
    </main>
  );
}
