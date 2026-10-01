import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import TransactionSupport from "@/components/orders/TransactionSupport";
export const dynamic = "force-dynamic";
export default async function HelpPage() {
  const client = await getServerClient();
  const viewer = await getCurrentUser(client as unknown as AuthClient);
  if (!viewer) redirect("/login?returnTo=%2Fbantuan");
  const { data, error } = await client.from("registrations").select("id,created_at").eq("umkm_id", viewer.userId).order("created_at", { ascending: false }).limit(50);
  return <main className="wesup-app mx-auto max-w-2xl space-y-5 p-5"><Link href="/">← Wesup</Link><h1 className="text-2xl font-bold">Bantuan dan keberatan transaksi</h1><p>Anda tetap dapat meminta pemeriksaan Admin ketika akses transaksi dibatasi. Pilih pesanan dan jelaskan kendalanya.</p>{error && <p role="alert">Pesanan belum dapat dimuat. Muat ulang untuk mencoba lagi.</p>}{(data ?? []).map(row => <section key={row.id}><h2 className="font-semibold">Pesanan {row.id.slice(0, 8)}</h2><TransactionSupport orderId={row.id} /></section>)}{!error && !data?.length && <p>Belum ada pesanan pada akun ini.</p>}</main>;
}
