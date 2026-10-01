"use client";

import { useRef, useState } from "react";
import { Alert, AsyncButton, Progress } from "@/components/feedback";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";
import { validateEarlyPaymentTarget, type EarlyPaymentContext } from "@/lib/transactions/early-payment";
import { useToast } from "@/components/ui/GlobalToast";

export default function EarlyPaymentPanel({ batchId, capacity, unit, context, onReload }: { batchId: string; capacity: number; unit: string; context: EarlyPaymentContext; onReload: () => void }) {
  const { toast } = useToast();
  const [target, setTarget] = useState(context.minimumQuantity ?? capacity);
  const [confirm, setConfirm] = useState<"open" | "configure" | "cancel" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);
  const [reviewed, setReviewed] = useState<EarlyPaymentContext | null>(null);
  const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  function review(action: "open" | "configure" | "cancel") {
    const invalid = action === "configure" ? validateEarlyPaymentTarget(target, capacity) : null;
    if (invalid) { setError(invalid); return; }
    if (action === "configure" && context.hasParticipantHistory && context.registeredQuantity < target) { setError("Target minimum belum tercapai. Tunggu pendaftaran tambahan sebelum mengirim usulan."); return; }
    setError(""); setUncertain(false); setReviewed(context); setConfirm(action);
    if (action === "configure") requestId.current = crypto.randomUUID();
  }
  async function submit() {
    if (lock.current || !confirm || !reviewed) return;
    if (uncertain) { setConfirm(null); onReload(); return; }
    lock.current = true; setPending(true); setError("");
    const snapshot = reviewed;
    const proposal = snapshot.proposal;
    const payload = confirm === "open" ? { confirmation: { registeredQuantity: snapshot.registeredQuantity, participants: snapshot.participants, tierNumber: snapshot.tierNumber, unitPrice: snapshot.unitPrice, proposalId: proposal?.id ?? null, proposalRevision: proposal?.revision ?? null } }
      : confirm === "cancel" ? { action: "cancel", proposalId: proposal?.id, revision: proposal?.revision }
        : { minimumQuantity: target, requestId: requestId.current };
    try {
      await feedbackJson(await fetch(`/api/suppliers/batches/${batchId}/${confirm === "open" ? "close" : "early-payment"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), "Hasil belum terkonfirmasi. Muat ulang transaksi sebelum mencoba lagi.");
      toast(confirm === "open" ? "Pembayaran dibuka. Tagihan sudah diterbitkan." : confirm === "cancel" ? "Usulan dibatalkan." : context.hasParticipantHistory ? "Usulan dikirim kepada peserta." : "Target minimum tersimpan.", "success");
      setConfirm(null); onReload();
    } catch (reason) { setUncertain(true); setError(feedbackError(reason, "Hasil belum terkonfirmasi. Muat ulang transaksi sebelum mencoba lagi.")); }
    finally { lock.current = false; setPending(false); }
  }
  const activeProposal = context.proposal && ["pending", "rejected"].includes(context.proposal.status);
  const targetControls = <div className="space-y-2"><label htmlFor="early-payment-target" className="block text-sm font-semibold">Target minimum ({unit})</label><input id="early-payment-target" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 sm:max-w-xs" type="number" min={1} max={capacity} step={1} value={target || ""} onChange={e => setTarget(Number(e.target.value))} /><p className="text-sm text-slate-600">{context.hasParticipantHistory ? "Mengubah usulan meminta persetujuan ulang seluruh peserta aktif. Target harus sudah tercapai." : "Target dikunci setelah peserta pertama bergabung."}</p><button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={() => review("configure")}>{context.hasParticipantHistory ? "Kirim usulan kepada peserta" : "Simpan target minimum"}</button></div>;
  return <section aria-label="Pembukaan pembayaran lebih awal" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-semibold">Pembukaan pembayaran lebih awal</h2>
    {context.minimumQuantity !== null && <><p className="text-sm">Target minimum {context.minimumQuantity} {unit} · Terkumpul {context.registeredQuantity} {unit}. Kapasitas maksimum {capacity} {unit}.</p><Progress value={Math.min(context.registeredQuantity, context.minimumQuantity)} max={context.minimumQuantity} label="Progres target minimum" /></>}
    <p className="text-sm text-slate-600">Pembayaran 24 jam sejak supplier menutup pengumpulan. Harga final terkunci; jadwal pengambilan tetap.</p>
    {context.proposal && ["pending", "rejected"].includes(context.proposal.status) && <Alert tone={context.proposal.status === "rejected" ? "warning" : "info"}>{context.proposal.status === "rejected" ? "Usulan ditolak. Aturan sebelumnya tetap berlaku." : `${context.accepted} dari ${context.participants} peserta aktif menyetujui revisi ${context.proposal.revision}. Persetujuan terakhir tidak membuka pembayaran otomatis.`}</Alert>}
    {context.reason && <p className="text-sm text-slate-600">{context.reason}</p>}
    {(context.canConfigure || context.canPropose) && (activeProposal ? <details className="space-y-3"><summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-slate-700">Ubah target dan minta persetujuan ulang</summary>{targetControls}</details> : targetControls)}
    <div className="flex flex-wrap gap-3"><AsyncButton disabled={!context.canOpen} onClick={() => review("open")}>Buka pembayaran sekarang</AsyncButton>{context.proposal && ["pending", "rejected"].includes(context.proposal.status) && <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4" onClick={() => review("cancel")}>Batalkan usulan</button>}</div>
    {error && !confirm && <Alert tone="error">{error}</Alert>}
    <ConfirmDialog open={confirm !== null} title={confirm === "open" ? "Buka pembayaran sekarang?" : confirm === "cancel" ? "Batalkan usulan pembukaan lebih awal?" : context.hasParticipantHistory ? "Kirim usulan kepada peserta?" : "Simpan target minimum?"}
      description={confirm === "open" ? `${reviewed?.participants} peserta, ${reviewed?.registeredQuantity} ${unit}. Harga final ${money.format(reviewed?.unitPrice ?? 0)} / ${unit} (tier ${reviewed?.tierNumber}). Pendaftaran dan pembatalan ditutup. Pembayaran 24 jam sejak penutupan berhasil; jadwal pengambilan tetap.` : confirm === "cancel" ? "Persetujuan usulan ini tidak lagi berlaku. Aturan asli penawaran tetap berjalan." : `Target ${target} ${unit}, terpisah dari ambang diskon dan kapasitas. ${context.hasParticipantHistory ? "Pembukaan menunggu persetujuan seluruh peserta aktif, kemudian konfirmasi supplier." : "Target dikunci setelah peserta pertama bergabung."}`}
      pending={pending} pendingLabel="Menyimpan…" error={error} confirmLabel={uncertain ? "Muat ulang transaksi" : "Ya, lanjutkan"} onCancel={() => setConfirm(null)} onConfirm={() => void submit()} />
  </section>;
}
