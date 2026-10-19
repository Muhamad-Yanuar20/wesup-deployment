import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import TransactionSupport from "@/components/orders/TransactionSupport";
import { PageHeader } from "@/components/layout/PageHeader";
export const dynamic = "force-dynamic";
export default async function HelpPage() {
  const client = await getServerClient();
  const viewer = await getCurrentUser(client as unknown as AuthClient);
  if (!viewer) redirect("/login?returnTo=%2Fbantuan");
  const { data, error } = await client.from("registrations").select("id,created_at").eq("umkm_id", viewer.userId).order("created_at", { ascending: false }).limit(50);
  return <main className="wesup-app min-h-dvh px-4 py-8 sm:px-6 sm:py-12 bg-wesup-paper text-wesup-ink"><div className="mx-auto max-w-3xl"><Link href="/" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-wesup-ink/30 underline-offset-4">← Wesup</Link><PageHeader title="Bantuan dan keberatan transaksi" eyebrow="Pusat bantuan" description="Anda tetap dapat meminta pemeriksaan Admin ketika akses transaksi dibatasi. Pilih pesanan dan jelaskan kendalanya." />{error && <p role="alert" className="mb-5 border-l-2 border-wesup-red p-4 text-sm">Pesanan belum dapat dimuat. Muat ulang untuk mencoba lagi.</p>}<div className="space-y-5">{(data ?? []).map(row => <section key={row.id} className="border border-wesup-ink/15 bg-wesup-paper-sub p-1.5"><h2 className="px-4 py-4 font-mono text-xs uppercase tracking-[0.18em]">Pesanan {row.id.slice(0, 8)}</h2><TransactionSupport orderId={row.id} /></section>)}</div>{!error && !data?.length && <p className="border border-wesup-ink/15 p-6 text-sm leading-7">Belum ada pesanan pada akun ini.</p>}</div></main>;
}
