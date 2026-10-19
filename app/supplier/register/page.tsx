import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";
import SupplierRegistrationForm from "@/components/supplier/SupplierRegistrationForm";
import { AuthHeader } from "@/components/auth/AuthHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pendaftaran Pemasok | Wesup",
  description: "Daftar sebagai mitra pemasok bahan baku UMKM di Wesup.",
};

export default async function SupplierRegistrationPage() {
  const viewer = await getViewerAccessState((await getServerClient()) as unknown as AccessStateClient);
  if (viewer) redirect(resolveHomePath(viewer));
  return (
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-8 sm:px-6 sm:py-12 lg:px-8 text-wesup-ink">
      <div className="mx-auto w-full max-w-6xl">
        <AuthHeader title="Pendaftaran Pemasok" eyebrow="Pendaftaran / Supplier" description="Bergabunglah sebagai mitra pemasok bahan baku UMKM dan bantu usaha lokal tumbuh bersama." backHref="/register" backLabel="← Pilih role lain" />

        <SupplierRegistrationForm />
      </div>
    </main>
  );
}
