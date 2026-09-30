import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Wesup",
  description: "Area administrasi Wesup.",
};

export default async function AdminPage() {
  const client = await getServerClient();
  const accessState = await getViewerAccessState(client as unknown as AccessStateClient);

  if (!accessState) redirect("/admin/login");
  if (accessState.role !== "admin" || accessState.status !== "active") {
    redirect(resolveHomePath(accessState));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Wesup Admin</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Pusat administrasi</h1>
            <p className="mt-3 max-w-2xl text-slate-300">Gunakan API Admin yang sudah tersedia untuk moderasi supplier, batch, audit, dan sengketa.</p>
          </div>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-blue-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            Kembali ke Wesup
          </Link>
        </header>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Akses Admin aktif</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Dashboard operasional Admin dapat dihubungkan ke modul moderasi berikutnya tanpa mencampurkan navigasi UMKM atau Supplier.</p>
        </section>
      </div>
    </main>
  );
}
