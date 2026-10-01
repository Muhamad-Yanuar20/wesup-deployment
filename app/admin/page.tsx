import type { Metadata } from "next";
import Link from "next/link";
import AdminTransactionSupport from "@/components/orders/AdminTransactionSupport";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

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

  return <div className="wesup-app flex h-dvh flex-col bg-slate-50 md:flex-row"><AdminSidebar /><div className="flex min-h-0 min-w-0 flex-1 flex-col"><AdminHeader title="Pusat administrasi" description="Tinjau pendaftaran usaha, penawaran, dan kendala transaksi." /><main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"><div className="mx-auto max-w-5xl"><section className="grid gap-4 sm:grid-cols-2">{[{ href: "/admin/suppliers", label: "Verifikasi Supplier", description: "Periksa pendaftaran usaha dan catatan survei." }, { href: "/admin/catalog", label: "Moderasi katalog", description: "Tinjau penawaran yang sedang tersedia." }, { href: "/admin/disputes", label: "Sengketa transaksi", description: "Periksa bukti dan tentukan hak dana." }, { href: "/admin/refunds", label: "Pengembalian dana", description: "Pantau antrean pengembalian dana." }].map(item => <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-300"><h2 className="text-lg font-semibold text-slate-900">{item.label}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></Link>)}</section><AdminTransactionSupport /></div></main></div></div>;
}
