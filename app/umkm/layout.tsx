import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getViewerAccessState, resolveHomePath, type AccessStateClient } from "@/lib/auth/access-state";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UmkmLayout({ children }: { children: ReactNode }) {
  const client = await getServerClient();
  const accessState = await getViewerAccessState(client as unknown as AccessStateClient);

  if (!accessState) redirect("/login?role=umkm");
  if (accessState.role !== "umkm" || !["active","suspended_temporary","suspended_permanent"].includes(accessState.status)) {
    redirect(resolveHomePath(accessState));
  }

  return <>{accessState.status !== "active" && <p role="status" className="bg-amber-50 px-4 py-3 text-sm text-amber-900">Akun Anda ditangguhkan. Pesanan dan pemeriksaan pembayaran tetap dapat diakses; transaksi baru belum tersedia.</p>}{children}</>;
}
