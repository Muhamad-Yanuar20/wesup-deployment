"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/feedback";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";
import type { EarlyPaymentContext } from "@/lib/transactions/early-payment";
import { useToast } from "@/components/ui/GlobalToast";

export default function EarlyPaymentDecision({ orderId, context, onReload, unit = "unit" }: { unit?: string; orderId: string; context: EarlyPaymentContext; onReload: () => void }) {
  const { toast } = useToast();
  const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const proposal = context.proposal;
  if (!proposal || !["pending", "rejected"].includes(proposal.status)) return null;
  async function decide() {
    if (lock.current || !choice || !proposal) return;
    lock.current = true; setPending(true); setError("");
    try {
      await feedbackJson(await fetch(`/api/umkm/orders/${orderId}/early-payment-decision`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, revision: proposal.revision, decision: choice }),
      }), "Keputusan belum terkonfirmasi. Muat ulang keputusan sebelum mencoba lagi.");
      setChoice(null);
      toast("Keputusan Anda tersimpan.", "success");
      onReload();
    } catch (reason) { setError(feedbackError(reason, "Keputusan belum terkonfirmasi. Muat ulang keputusan sebelum mencoba lagi.")); }
    finally { lock.current = false; setPending(false); }
  }
  return <>
    <Alert tone="info" title="Usulan pembayaran lebih awal">
      <p>Supplier mengusulkan penutupan pendaftaran setelah terkumpul minimal {proposal.minimumQuantity} {unit}. Setelah supplier mengonfirmasi, pembayaran berlangsung 24 jam dan pembatalan ditutup. Jadwal pengambilan tetap.</p>
      <p className="mt-2">Pembukaan memerlukan persetujuan seluruh peserta aktif. Menolak atau tidak menjawab tidak menambah penalti; aturan sebelumnya tetap berlaku.</p>
      {proposal.status === "rejected" ? <p className="mt-3 font-semibold">Usulan ini tidak disetujui seluruh peserta. Aturan sebelumnya tetap berlaku.</p>
        : proposal.decision ? <p className="mt-3 font-semibold">{proposal.decision === "accepted" ? "Anda sudah menyetujui usulan. Pembayaran belum dibuka sampai supplier mengonfirmasi." : "Anda memilih aturan sebelumnya."}</p>
          : context.canDecide && <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-white" onClick={() => { setError(""); setChoice("accepted"); }}>Setuju pembukaan lebih awal</button><button type="button" className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 py-2" onClick={() => { setError(""); setChoice("rejected"); }}>Tetap gunakan aturan sebelumnya</button></div>}
    </Alert>
    <ConfirmDialog open={choice !== null} title={choice === "accepted" ? "Setujui pembukaan pembayaran lebih awal?" : "Tetap gunakan aturan sebelumnya?"}
      description={choice === "accepted" ? "Supplier dapat membuka pembayaran sewaktu-waktu sebelum cutoff setelah target tercapai dan seluruh peserta setuju. Anda memiliki 24 jam untuk membayar sejak penutupan aktual. Jadwal pengambilan tetap." : "Usulan ini diblokir. Penolakan ini tidak menambah penalti dan jadwal mengikuti aturan sebelumnya."}
      confirmLabel={error ? "Muat ulang keputusan" : choice === "accepted" ? "Ya, setuju" : "Ya, gunakan aturan sebelumnya"}
      pending={pending} error={error} onCancel={() => setChoice(null)} onConfirm={() => error ? (setChoice(null), onReload()) : void decide()} />
  </>;
}
