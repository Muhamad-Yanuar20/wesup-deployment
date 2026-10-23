import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AppPanel } from "@/components/layout/AppPanel";
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
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-8 sm:px-6 sm:py-12 lg:px-8 text-wesup-ink">
      <div className="mx-auto w-full max-w-2xl">
        <AuthHeader title="Mulai belanja bersama" eyebrow="Pendaftaran / UMKM" description="Buat akun singkat sekarang. Profil usaha dan lokasi pickup bisa Anda lengkapi saat ingin bergabung batch." backHref="/register" backLabel="← Pilih role lain" />

        <AppPanel panelClassName="sm:!p-9">
          <UmkmSignupForm returnTo={returnTo} />
        </AppPanel>
      </div>
    </main>
  );
}
