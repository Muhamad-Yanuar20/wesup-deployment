"use client";

import { useState } from "react";
import { Banknote, Landmark, Wallet } from "lucide-react";

type Account = { id: string; bank_name: string; account_number: string; account_holder_name: string; is_primary: boolean };
type Finance = { balances?: { escrow?: number; frozen?: number; available?: number; paidOut?: number }; accounts?: Account[]; payouts?: Array<{ id: string; amount: number; status: string; requested_at: string }> };
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

import { Alert, AsyncButton, ContentSkeleton, ErrorState, EmptyState } from "@/components/feedback";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";
import { useToast } from "@/components/ui/GlobalToast";

export default function SupplierFinanceClient() {
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
    setSaving(current => ({ ...current, [kind]: true })); setError("");
    try {
      const result = await fetch(kind === "account" ? "/api/suppliers/finance/bank-account" : "/api/suppliers/finance/payouts", {
        method: kind === "account" ? "PUT" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "account" ? account : { amount: Number(amount), bankAccountId: primary?.id })
      });
      await feedbackJson(result, "Hasil penyimpanan belum terkonfirmasi. Periksa data terbaru sebelum mengirim ulang.");
      setConfirm(null);
      if (kind === "account") setAccount({ bankName: "", accountNumber: "", accountHolderName: "", isPrimary: true }); else setAmount("");
      toast(kind === "account" ? "Rekening tersimpan." : "Pengajuan transfer diterima.", "success");
      await reload();
    } catch (reason) { setError(feedbackError(reason, "Hasil penyimpanan belum terkonfirmasi. Periksa data terbaru sebelum mengirim ulang.")); }
    finally { setSaving(current => ({ ...current, [kind]: false })); }
  }
  const saveAccount = (event: React.FormEvent) => { event.preventDefault(); setError(""); if (account.isPrimary && primary) setConfirm("account"); else void mutate("account"); };
  const requestPayout = (event: React.FormEvent) => { event.preventDefault(); setError(""); if (!primary) { setError("Tetapkan rekening utama terlebih dahulu."); return; } setConfirm("payout"); };
  if (!response && loading) return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><ContentSkeleton label="Memuat keuangan…" /></div>;
  if (!data) return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"><ErrorState title="Keuangan belum dapat dimuat." description={readError && readError !== "Keuangan belum dapat dimuat." ? readError : "Saldo dan rekening belum dapat ditampilkan. Periksa koneksi lalu coba lagi."} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} /></div>;
  return <div className="wesup-app min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl space-y-6"><header><h1 className="text-2xl font-bold text-slate-900">Keuangan Supplier</h1><p className="mt-1 text-sm text-slate-500">Dana ditahan → Saldo tersedia → Pengajuan transfer → Sudah ditransfer. Saldo tersedia belum berarti transfer bank selesai.</p></header>{readError && <Alert tone="warning" action={<button onClick={() => void reload()} className="font-semibold underline">Coba perbarui</button>}>Data terakhir ditampilkan; pembaruan belum berhasil.</Alert>}{error && !confirm && <Alert tone="error">{error}</Alert>}<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Balance icon={<Wallet />} label="Dana ditahan" value={data?.balances?.escrow} /><Balance icon={<Wallet />} label="Dibekukan" value={data?.balances?.frozen} /><Balance icon={<Banknote />} label="Siap Dicairkan" value={data?.balances?.available} /><Balance icon={<Banknote />} label="Sudah Ditransfer" value={data?.balances?.paidOut} /></section><div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 font-bold text-slate-900"><Landmark size={18} /> Rekening utama</h2>{data?.accounts?.map((item) => <div key={item.id} className="mt-3 rounded-xl border border-slate-200 p-3 text-sm"><p className="font-semibold">{item.bank_name} {item.is_primary && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Utama</span>}</p><p className="text-slate-600">{item.account_number} · {item.account_holder_name}</p></div>)}<form onSubmit={saveAccount} className="mt-5 space-y-3"><label className="block text-sm font-medium">Nama bank<input required placeholder="Nama bank" value={account.bankName} onChange={(e) => setAccount({ ...account, bankName: e.target.value })} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-sm font-medium">Nomor rekening<input required inputMode="numeric" placeholder="Nomor rekening" value={account.accountNumber} onChange={(e) => setAccount({ ...account, accountNumber: e.target.value })} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="block text-sm font-medium">Nama pemilik rekening<input required placeholder="Nama pemilik rekening" value={account.accountHolderName} onChange={(e) => setAccount({ ...account, accountHolderName: e.target.value })} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={account.isPrimary} onChange={(e) => setAccount({ ...account, isPrimary: e.target.checked })} /> Jadikan rekening utama</label><AsyncButton pending={saving.account} pendingLabel="Menyimpan rekening…">Simpan rekening</AsyncButton></form></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Ajukan pencairan</h2><p className="mt-1 text-xs text-slate-500">Transfer diproses Admin secara manual setelah saldo tersedia.</p><form onSubmit={requestPayout} className="mt-5 space-y-3"><label className="block text-sm font-medium">Nominal transfer (Rp)<input required min={1} step={1} type="number" placeholder="Nominal IDR" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><AsyncButton pending={saving.payout} disabled={!primary} pendingLabel="Mengajukan transfer…">Ajukan transfer</AsyncButton></form><h3 className="mt-6 text-sm font-semibold text-slate-700">Riwayat pengajuan transfer</h3><div className="mt-2 space-y-2">{!data.payouts?.length && <EmptyState embedded title="Belum ada pengajuan transfer." />}{data?.payouts?.map((item) => <div key={item.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{money.format(item.amount)}</span><span className="text-slate-500">{({pending:"Pengajuan transfer",approved:"Transfer disetujui",paid:"Sudah ditransfer",completed:"Sudah ditransfer",rejected:"Pengajuan ditolak"} as Record<string,string>)[item.status]??item.status}</span></div>)}</div></section></div><ConfirmDialog open={Boolean(confirm)} title={confirm === "account" ? "Ganti rekening utama?" : "Ajukan transfer?"} description={confirm === "account" ? `${account.bankName} · ${account.accountNumber} · ${account.accountHolderName}. Rekening ini akan menjadi tujuan transfer berikutnya.` : `${money.format(Number(amount))} ke ${primary?.bank_name} · ${primary?.account_number} · ${primary?.account_holder_name}. Pengajuan akan diperiksa Admin; dana belum ditransfer.`} pending={confirm ? saving[confirm] : false} error={error} confirmLabel={confirm === "account" ? "Simpan rekening utama" : "Ajukan transfer"} onConfirm={() => confirm && void mutate(confirm)} onCancel={() => setConfirm(null)} /></div></div>;
}

function Balance({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</div><p className="mt-2 text-xl font-bold text-slate-900">{value === undefined ? "Belum tersedia" : money.format(value)}</p></div>; }
