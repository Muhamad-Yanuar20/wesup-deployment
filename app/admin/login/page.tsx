import type { Metadata } from "next";
import Link from "next/link";
import { sanitizeReturnTo } from "@/lib/auth/access-state";
import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login Admin | Wesup",
  description: "Login khusus Admin Wesup.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo, "admin");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white">W</span>
            <span className="text-lg font-extrabold tracking-tight">Wesup Admin</span>
          </Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Area terbatas</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Login Admin</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-300">Gunakan kredensial Admin untuk mengakses moderasi dan pengaturan platform.</p>
        </header>
        <div className="rounded-3xl border border-slate-700 bg-white p-5 shadow-2xl sm:p-9">
          <LoginForm fixedRole="admin" returnTo={returnTo} />
        </div>
      </div>
    </main>
  );
}
