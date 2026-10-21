"use client";

import Link from "next/link";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPanel } from "@/components/layout/AppPanel";
import { Alert, AsyncButton, ContentSkeleton, ErrorState, EmptyState } from "@/components/feedback";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";
import { useToast } from "@/components/ui/GlobalToast";

export type SupplierFinanceView = "overview" | "escrow" | "bank-account";
type Account = { id: string; bank_name: string; account_number: string; account_holder_name: string; is_primary: boolean };
type Finance = { balances?: { escrow?: number; frozen?: number; available?: number; paidOut?: number }; accounts?: Account[]; payouts?: Array<{ id: string; amount: number; status: string; requested_at: string }> };
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });
const inputClass = "mt-2 min-h-11 w-full border border-wesup-ink/20 bg-wesup-paper px-4 py-3 font-sans text-sm normal-case tracking-normal text-wesup-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red";
const labelClass = "block font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub";
const headings = { overview: "Keuangan Supplier", escrow: "Monitoring Escrow", "bank-account": "Rekening Supplier" };
const navigation = [
  { view: "overview", href: "/supplier/keuangan", label: "Ringkasan" },
  { view: "escrow", href: "/supplier/akun/escrow", label: "Escrow" },
  { view: "bank-account", href: "/supplier/akun/rekening", label: "Rekening" },
] as const;

export default function SupplierFinanceClient({ view = "overview" }: { view?: SupplierFinanceView }) {
  const { data: response, loading, error: readError, reload } = useFeedbackResource<{ item: Finance }>("/api/suppliers/finance", "Keuangan belum dapat dimuat.");
  const data = response?.item;
  const { toast } = useToast();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState({ account: false, payout: false });
  const [confirm, setConfirm] = useState<"account" | "payout" | null>(null);
  const [account, setAccount] = useState({ bankName: "", accountNumber: "", accountHolderName: "", isPrimary: true });
  const [amount, setAmount] = useState("");
  const primary = data?.accounts?.find(item => item.is_primary);

  async function mutate(kind: "account" | "payout") {
    if (saving[kind]) return;
    setSaving(current => ({ ...current, [kind]: true }));
    setError("");
    try {
      const result = await fetch(kind === "account" ? "/api/suppliers/finance/bank-account" : "/api/suppliers/finance/payouts", {
        method: kind === "account" ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "account" ? account : { amount: Number(amount), bankAccountId: primary?.id }),
      });
      await feedbackJson(result, "Hasil penyimpanan belum terkonfirmasi. Periksa data terbaru sebelum mengirim ulang.");
      setConfirm(null);
      if (kind === "account") setAccount({ bankName: "", accountNumber: "", accountHolderName: "", isPrimary: true });
      else setAmount("");
      toast(kind === "account" ? "Rekening tersimpan." : "Pengajuan transfer diterima.", "success");
      await reload();
    } catch (reason) {
      setError(feedbackError(reason, "Hasil penyimpanan belum terkonfirmasi. Periksa data terbaru sebelum mengirim ulang."));
    } finally {
      setSaving(current => ({ ...current, [kind]: false }));
    }
  }

  function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (account.isPrimary && primary) setConfirm("account");
    else void mutate("account");
  }
  function requestPayout(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!primary) { setError("Tetapkan rekening utama terlebih dahulu."); return; }
    setConfirm("payout");
  }

  if (!response && loading) return <PageContainer><ContentSkeleton label="Memuat keuangan…" variant="table" /></PageContainer>;
  if (!data) return <PageContainer><ErrorState title="Keuangan belum dapat dimuat." description={readError && readError !== "Keuangan belum dapat dimuat." ? readError : "Saldo dan rekening belum dapat ditampilkan. Periksa koneksi lalu coba lagi."} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} /></PageContainer>;

  return <PageContainer className="tabular-nums">
    <PageHeader title={headings[view]} eyebrow="Supplier / Keuangan" description={view === "bank-account" ? "Kelola rekening tujuan transfer. Pastikan nama dan nomor rekening sesuai sebelum menyimpan." : "Dana ditahan → Saldo tersedia → Pengajuan transfer → Sudah ditransfer. Saldo tersedia belum berarti transfer bank selesai."} />
    <nav aria-label="Navigasi keuangan" className="mb-8 flex flex-wrap border-b border-wesup-ink/15">
      {navigation.map(item => <Link key={item.view} href={item.href} aria-current={view === item.view ? "page" : undefined} className={`inline-flex min-h-12 items-center border-b-2 px-4 font-mono text-[0.6875rem] uppercase tracking-[0.18em] transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub ${view === item.view ? "border-wesup-red text-wesup-ink" : "border-transparent text-wesup-ink-sub"}`}>{item.label}</Link>)}
    </nav>
    <div className="space-y-7">
      {readError && <Alert tone="warning" action={<button onClick={() => void reload()} className="font-semibold underline">Coba perbarui</button>}>Data terakhir ditampilkan; pembaruan belum berhasil.</Alert>}
      {error && !confirm && <Alert tone="error">{error}</Alert>}
      {view !== "bank-account" && <AppPanel panelClassName="!p-0"><dl className={`grid grid-cols-2 gap-px border border-wesup-ink/15 bg-wesup-ink/15 ${view === "overview" ? "xl:grid-cols-4" : ""}`}>
        <Balance label="Dana ditahan" value={data.balances?.escrow} />
        <Balance label="Dibekukan" value={data.balances?.frozen} />
        {view === "overview" && <><Balance label="Siap Dicairkan" value={data.balances?.available} /><Balance label="Sudah Ditransfer" value={data.balances?.paidOut} /></>}
      </dl></AppPanel>}
      {view === "escrow" && <AppPanel>
        <h2 className="font-landing-display text-2xl font-normal uppercase tracking-[0.04em]">Tahap dana Anda</h2>
        <dl className="mt-5 divide-y divide-wesup-ink/15 border-y border-wesup-ink/15">
          <FinanceStage label="01 / Dana ditahan">Dana berada dalam escrow selama pemeriksaan setelah pengambilan. Dana yang masih ditahan belum dapat diajukan untuk transfer.</FinanceStage>
          <FinanceStage label="02 / Dibekukan">Dana yang berkaitan dengan sengketa menunggu penyelesaian Admin.</FinanceStage>
          <FinanceStage label="03 / Saldo tersedia">Dana yang sudah tersedia dapat diajukan untuk transfer melalui halaman ringkasan keuangan.</FinanceStage>
          <FinanceStage label="04 / Transfer">Admin memproses pengajuan secara manual. Status sudah ditransfer menunjukkan proses transfer telah selesai.</FinanceStage>
        </dl>
        <Link href="/supplier/keuangan" className="mt-6 inline-flex min-h-12 items-center border border-wesup-ink bg-wesup-ink px-6 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red">Lihat ringkasan keuangan →</Link>
      </AppPanel>}
      {view === "bank-account" && <div className="grid items-start gap-6 lg:grid-cols-2"><AppPanel>
        <h2 className="font-landing-display text-2xl font-normal uppercase tracking-[0.04em]">Rekening pencairan</h2>
        <div className="mt-5 divide-y divide-wesup-ink/15 border-y border-wesup-ink/15">
          {data.accounts?.length ? data.accounts.map(item => <AccountReadout key={item.id} account={item} />) : <EmptyState embedded title="Belum ada rekening." description="Tambahkan rekening untuk menerima pencairan dana." />}
        </div>
        </AppPanel><AppPanel><h2 className="font-landing-display text-2xl font-normal uppercase tracking-[0.04em]">Tambah rekening</h2><p className="mt-3 text-sm leading-7 text-wesup-ink-sub">Pastikan tujuan pencairan sesuai dengan data rekening Anda.</p>
        <form onSubmit={saveAccount} className="mt-7 space-y-5">
          <label className={labelClass}>Nama bank<input required value={account.bankName} onChange={e => setAccount({ ...account, bankName: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Nomor rekening<input required inputMode="numeric" value={account.accountNumber} onChange={e => setAccount({ ...account, accountNumber: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Nama pemilik rekening<input required value={account.accountHolderName} onChange={e => setAccount({ ...account, accountHolderName: e.target.value })} className={inputClass} /></label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={account.isPrimary} onChange={e => setAccount({ ...account, isPrimary: e.target.checked })} className="size-4 accent-wesup-ink" />Jadikan rekening utama</label>
          <AsyncButton pending={saving.account} pendingLabel="Menyimpan rekening…">Simpan rekening</AsyncButton>
        </form>
      </AppPanel></div>}
      {view === "overview" && <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <AppPanel>
          <h2 className="font-landing-display text-2xl font-normal uppercase tracking-[0.04em]">Ajukan pencairan</h2>
          <p className="mt-3 text-sm leading-7 text-wesup-ink-sub">Transfer diproses Admin secara manual setelah saldo tersedia.</p>
          <form onSubmit={requestPayout} className="mt-6 space-y-5">
            <label className={labelClass}>Nominal transfer (Rp)<input required min={1} step={1} type="number" placeholder="Nominal IDR" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} /></label>
            {!primary && <p className="border-l-2 border-wesup-red pl-3 text-sm leading-6">Tetapkan rekening utama terlebih dahulu di halaman rekening.</p>}
            <AsyncButton pending={saving.payout} disabled={!primary} pendingLabel="Mengajukan transfer…">Ajukan transfer</AsyncButton>
          </form>
        </AppPanel>
        <AppPanel>
          <h2 className="font-landing-display text-2xl font-normal uppercase tracking-[0.04em]">Rekening utama</h2>
          {primary ? <AccountReadout account={primary} /> : <p className="mt-4 text-sm leading-7 text-wesup-ink-sub">Rekening utama belum tersedia.</p>}
          <Link href="/supplier/akun/rekening" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-wesup-ink/30 underline-offset-4 transition-colors duration-300 hover:decoration-wesup-red">Kelola rekening →</Link>
        </AppPanel>
      </div>}
      {view === "overview" && <AppPanel><PayoutHistory payouts={data.payouts} /></AppPanel>}
    </div>
    <ConfirmDialog open={Boolean(confirm)} title={confirm === "account" ? "Ganti rekening utama?" : "Ajukan transfer?"} description={confirm === "account" ? `${account.bankName} · ${account.accountNumber} · ${account.accountHolderName}. Rekening ini akan menjadi tujuan transfer berikutnya.` : `${money.format(Number(amount))} ke ${primary?.bank_name} · ${primary?.account_number} · ${primary?.account_holder_name}. Pengajuan akan diperiksa Admin; dana belum ditransfer.`} pending={confirm ? saving[confirm] : false} error={error} confirmLabel={confirm === "account" ? "Simpan rekening utama" : "Ajukan transfer"} onConfirm={() => confirm && void mutate(confirm)} onCancel={() => setConfirm(null)} />
  </PageContainer>;
}

function Balance({ label, value }: { label: string; value?: number }) {
  return <div className="flex min-w-0 flex-col bg-wesup-paper px-3 py-6 sm:px-5"><dt className="order-2 mt-3 font-mono text-[0.625rem] uppercase leading-5 tracking-[0.14em] text-wesup-ink-sub sm:text-[0.6875rem] sm:tracking-[0.18em]">{label}</dt><dd className="break-words font-landing-display text-xl font-normal tracking-tight text-wesup-ink sm:text-2xl xl:text-3xl"><span aria-hidden="true" className="mb-5 block h-px w-8 bg-wesup-red" />{value === undefined ? "Belum tersedia" : money.format(value)}</dd></div>;
}
function FinanceStage({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-3 py-5 sm:grid-cols-[12rem_1fr] sm:gap-6"><dt className="font-mono text-[0.6875rem] uppercase leading-6 tracking-[0.18em]">{label}</dt><dd className="text-sm leading-7 text-wesup-ink-sub">{children}</dd></div>;
}
function AccountReadout({ account }: { account: Account }) {
  return <div className="py-4"><p className="flex flex-wrap items-center gap-3 font-semibold">{account.bank_name}{account.is_primary && <span className="bg-wesup-paper-sub px-2 py-1 font-mono text-[0.6875rem] font-normal uppercase tracking-[0.14em]">Utama</span>}</p><p className="mt-2 break-all font-mono text-sm tabular-nums">{account.account_number}</p><p className="mt-1 text-sm leading-6 text-wesup-ink-sub">{account.account_holder_name}</p></div>;
}
function PayoutHistory({ payouts }: { payouts: Finance["payouts"] }) {
  const labels: Record<string, string> = { pending: "Pengajuan transfer", approved: "Transfer disetujui", paid: "Sudah ditransfer", completed: "Sudah ditransfer", rejected: "Pengajuan ditolak" };
  return <div><h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.18em]">Riwayat pengajuan transfer</h3>{!payouts?.length ? <EmptyState embedded title="Belum ada pengajuan transfer." /> : <ul className="mt-4 divide-y divide-wesup-ink/15">{payouts.map(item => <li key={item.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"><div><p className="font-semibold">{money.format(item.amount)}</p><time dateTime={item.requested_at} className="mt-1 block font-mono text-xs text-wesup-ink-sub">{dates.format(new Date(item.requested_at))}</time></div><span className={`self-start font-mono text-[0.6875rem] uppercase leading-6 tracking-[0.1em] ${item.status === "rejected" ? "border-l-2 border-wesup-red pl-3" : ""}`}>{labels[item.status] ?? item.status}</span></li>)}</ul>}</div>;
}
