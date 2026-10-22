import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import TransactionSupport from "@/components/orders/TransactionSupport";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPanel } from "@/components/layout/AppPanel";
export const dynamic = "force-dynamic";
export default async function HelpPage() {
  const client = await getServerClient();
  const viewer = await getCurrentUser(client as unknown as AuthClient);
  if (!viewer) redirect("/login?returnTo=%2Fbantuan");
  const { data, error } = await client.from("registrations").select("id,created_at").eq("umkm_id", viewer.userId).order("created_at", { ascending: false }).limit(50);
  return <main className="wesup-app min-h-dvh bg-wesup-paper px-4 py-8 text-wesup-ink sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl">
    <Link href="/" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-wesup-ink/30 underline-offset-4">← Wesup</Link>
    <PageHeader title="Bantuan dan keberatan transaksi" eyebrow="Pusat bantuan" description="Anda tetap dapat meminta pemeriksaan Admin ketika akses transaksi dibatasi. Pilih pesanan dan jelaskan kendalanya." />
    {error && <p role="alert" className="mb-5 border-l-2 border-wesup-red p-4 text-sm">Pesanan belum dapat dimuat. Muat ulang untuk mencoba lagi.</p>}
    <div className="space-y-6">{(data ?? []).map((row, index) => <AppPanel key={row.id}><section aria-labelledby={`support-${row.id}`}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-wesup-ink/15 pb-5"><h2 id={`support-${row.id}`} className="font-landing-display text-xl uppercase tracking-[0.04em]">Pesanan {row.id.slice(0, 8)}</h2><span className="font-mono text-[0.6875rem] uppercase tabular-nums tracking-[0.18em]">{String(index + 1).padStart(2, "0")} / Dukungan transaksi</span></header>
      <TransactionSupport orderId={row.id} />
    </section></AppPanel>)}</div>
    {!error && !data?.length && <AppPanel><h2 className="font-landing-display text-2xl uppercase">Belum ada pesanan</h2><p className="mt-4 text-sm leading-7">Pesanan pada akun ini akan muncul di sini agar Anda dapat meminta bantuan transaksi.</p></AppPanel>}
  </div></main>;
}
