import type { Metadata } from "next";
import Link from "next/link";
import { sanitizeReturnTo } from "@/lib/auth/access-state";
import LoginForm from "@/components/auth/LoginForm";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AppPanel } from "@/components/layout/AppPanel";

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
    <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-12 sm:px-6 lg:px-8 text-wesup-ink">
      <div className="mx-auto w-full max-w-2xl">
        <AuthHeader title="Masuk ke akun Anda" eyebrow="Akses / Wesup" description="Pilih role akun UMKM atau Supplier untuk melanjutkan aktivitas di Wesup." />

        <AppPanel panelClassName="sm:!p-9">
          <LoginForm initialRole={initialRole} returnTo={returnTo} />
        </AppPanel>

        <p className="mt-6 text-center text-sm text-wesup-ink-sub">
          <Link href="/" className="font-semibold text-wesup-ink-sub underline-offset-4 hover:underline">Kembali ke beranda</Link>
          <span className="mx-2 text-wesup-ink-sub" aria-hidden="true">·</span>
          <Link href="/admin/login" className="font-semibold text-wesup-ink-sub underline-offset-4 hover:underline">Login Admin</Link>
        </p>
      </div>
    </main>
  );
}
