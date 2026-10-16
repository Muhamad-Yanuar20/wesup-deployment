"use client";
import Link from "next/link";
import { useState } from "react";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { formatTransactionDate } from "@/lib/transactions/schedule";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";
import EarlyPaymentDecision from "./EarlyPaymentDecision";
import { Alert } from "@/components/feedback";
import TransactionSupport from "./TransactionSupport";

export default function TransactionOverview({order,onReload,children}:{order:UmkmOrderDetail;onReload:()=>void;children?:React.ReactNode}) {
 const [confirm,setConfirm]=useState<"withdraw" | "wait" | "refund" | null>(null); const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function act(path:string,body?:unknown) {setBusy(true);setMessage("");try {const response=await fetch(`/api/umkm/orders/${order.id}/${path}`,{method:"POST",headers:{"content-type":"application/json"},body:body?JSON.stringify(body):undefined});await feedbackJson(response,"Hasil belum terkonfirmasi. Muat ulang detail sebelum mencoba lagi.");setConfirm(null);onReload();}catch(e){setMessage(feedbackError(e,"Hasil belum terkonfirmasi. Muat ulang detail sebelum mencoba lagi."));}finally{setBusy(false);}}
 const stages=["Pengumpulan","Pembayaran","Barang disiapkan","Pengambilan","Pemeriksaan","Selesai"];
 const active=order.status==='registered'?0:order.status==='pending_payment'?1:order.status==='paid'?(order.phase==='paid_waiting_ready'?2:3):order.status==='picked_up'?4:order.status==='completed'?5:-1;
 const proposed=order.pickupReplacements?.filter(p=>p.id!==order.acceptedPickupRevision&&Date.parse(p.startsAt)>Date.parse(order.serverTime)).sort((a,b)=>b.revision-a.revision)[0];
 return <div className="space-y-8">
  {!(order.paymentProgress?.integrityIssue && order.invoice) && <section className="relative border border-wesup-ink/20 bg-wesup-paper p-5 pl-6">
    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-0.5 ${order.status==='cancelled'||order.status==='no_show'?'bg-wesup-red':'bg-wesup-ink'}`} />
    <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-wesup-ink-sub">Tahap saat ini</p>
    <h2 className="mt-3 font-landing-display text-2xl uppercase tracking-[0.04em] text-wesup-ink">{order.presentation?.label??order.status}</h2>
    <p className="mt-2 text-sm leading-6 text-wesup-ink-sub">{order.presentation?.explanation}</p>
    {order.presentation?.deadlineAt&&<p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink">Batas tahap ini: <span className="tabular-nums">{formatTransactionDate(order.presentation.deadlineAt)}</span></p>}
    <button type="button" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red" onClick={onReload}>Muat ulang detail</button>
  </section>}
  {order.earlyPaymentError && <Alert tone="warning">{order.earlyPaymentError}</Alert>}
  {order.earlyPayment && <EarlyPaymentDecision orderId={order.id} unit={order.unit} context={order.earlyPayment} onReload={onReload} />}
  {children}
  <ol aria-label="Perjalanan pesanan" className="grid grid-cols-2 gap-px border border-wesup-ink/10 bg-wesup-ink/10 sm:grid-cols-3 lg:grid-cols-6">{stages.map((s,i)=><li key={s} aria-current={i===active?'step':undefined} className={`bg-wesup-paper p-3 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] ${i===active?'text-wesup-ink':i<active?'text-wesup-ink-sub':'text-wesup-ink-sub/50'}`}><span aria-hidden="true" className={`mx-auto mb-2 block h-px w-6 ${i===active?'bg-wesup-red':i<active?'bg-wesup-ink/40':'bg-wesup-ink/15'}`} />{s}</li>)}</ol>
  <section id="jadwal" className="border border-wesup-ink/15 bg-wesup-paper">
    <header className="border-b border-wesup-ink/10 px-4 py-3 sm:px-5"><h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Jadwal dan lokasi · WIB</h2></header>
    <div className="p-4 sm:p-5">
      {order.closeReason==='supplier_manual'&&<p className="mb-4 border-l-2 border-wesup-red pl-3 text-sm text-wesup-ink-sub">Supplier membuka pembayaran lebih awal. Harga final sudah terkunci; jadwal pengambilan tetap.</p>}
      {order.closeReason==='capacity_reached'&&<p className="mb-4 border-l-2 border-wesup-red pl-3 text-sm text-wesup-ink-sub">Pengumpulan selesai karena kapasitas penuh. Harga final sudah terkunci.</p>}
      <dl className="divide-y divide-wesup-ink/10">{([["Batas ikut",order.timeline.registrationClosesAt],["Pembayaran dibuka",order.timeline.paymentOpensAt],["Batas bayar",order.timeline.paymentClosesAt],["Pengambilan mulai",order.timeline.estimatedReadyAt],["Pengambilan selesai",order.timeline.pickupDeadlineAt],["Batas komplain",order.timeline.complaintDeadlineAt]] as const).map(([label,value])=><div key={label} className="grid grid-cols-1 py-2.5 sm:grid-cols-[12rem_1fr]"><dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{label}</dt><dd className="mt-1 text-sm tabular-nums text-wesup-ink sm:mt-0 sm:border-l sm:border-wesup-ink/15 sm:pl-4">{formatTransactionDate(value)}</dd></div>)}</dl>
      <p className="mt-4 border-t border-wesup-ink/10 pt-4 text-sm leading-6 text-wesup-ink">{order.pickupAddress??order.pickup?.address}</p>
      {order.cancellationReason&&<p className="mt-3 text-sm leading-6 text-wesup-ink-sub">Alasan: {({buyer_withdrawal:"Anda membatalkan sebelum batas ikut",supplier_late:"Supplier terlambat menyiapkan barang",supplier_cancel:"Supplier membatalkan penawaran",payment_deadline:"Batas pembayaran terlewat setelah pemeriksaan pembayaran",verified_disruption:"Gangguan terverifikasi; tidak ada penalti pembayaran",pickup_deadline:"Batas pengambilan yang disetujui terlewat"} as Record<string,string>)[order.cancellationReason]??"Hubungi Admin untuk penjelasan pembatalan"}</p>}
    </div>
  </section>
  {order.capabilities.canWithdraw && <section className="border border-wesup-red bg-wesup-paper p-4"><button className="min-h-11 font-semibold text-wesup-red underline decoration-wesup-red/40 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red" onClick={() => { setMessage(""); setConfirm("withdraw"); }}>Batalkan sebelum batas ikut</button></section>}
  {order.capabilities.canChoosePickup&&<section className="space-y-3 border border-wesup-ink/15 bg-wesup-paper p-5">
    <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">Pilih kelanjutan pesanan</h2>
    <p className="text-sm leading-6 text-wesup-ink-sub">Anda berhak mendapat pengembalian penuh. Jika belum memilih saat periode pengambilan yang disetujui berakhir, pengembalian otomatis masuk antrean Admin.</p>
    {proposed&&<><p className="border-l-2 border-wesup-red pl-3 text-sm text-wesup-ink-sub">Usulan: <span className="tabular-nums">{formatTransactionDate(proposed.startsAt)} – {formatTransactionDate(proposed.endsAt)}</span>. {proposed.reason}</p><button disabled={busy} className="min-h-11 border border-wesup-ink bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red disabled:opacity-60" onClick={() => { setMessage(""); setConfirm("wait"); }}>Saya setuju jadwal baru ini</button></>}
    <button disabled={busy} className="min-h-11 border border-wesup-ink/20 bg-wesup-paper px-4 py-2 text-sm font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub disabled:opacity-60" onClick={() => { setMessage(""); setConfirm("refund"); }}>Minta pengembalian dana penuh</button>
  </section>}
  {message && !confirm && <p role="alert" className="text-sm text-wesup-red">{message}</p>}
  {order.status==='cancelled'&&order.cancellationReason==='buyer_withdrawal'&&<Link className="inline-flex min-h-12 items-center border border-wesup-ink bg-wesup-ink px-6 py-3 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5" href={`/marketplace/${order.batchId}`}>Periksa penawaran untuk ikut kembali</Link>}
  <ConfirmDialog open={Boolean(confirm)} title={confirm === "withdraw" ? "Batalkan keikutsertaan?" : confirm === "wait" ? "Setujui jadwal ini?" : "Ajukan pengembalian dana penuh?"} description={confirm === "withdraw" ? "Pembatalan tanpa penalti sebelum pengumpulan ditutup. Jumlah terkumpul berkurang dan estimasi diskon peserta lain dapat turun." : confirm === "wait" ? `Pengambilan ${formatTransactionDate(proposed?.startsAt)} – ${formatTransactionDate(proposed?.endsAt)}. Jadwal ini menjadi komitmen pengambilan Anda.` : "Pesanan dihentikan dan pengembalian penuh masuk antrean Admin. Dana belum langsung ditransfer."} pending={busy} error={message} onCancel={() => setConfirm(null)} confirmLabel={confirm === "withdraw" ? "Ya, batalkan keikutsertaan" : "Ya, lanjutkan"} onConfirm={() => void (confirm === "withdraw" ? act("withdraw") : act("pickup-decision", confirm === "wait" ? { decision: "wait", replacementId: proposed?.id } : { decision: "refund" }))} />
  <TransactionSupport orderId={order.id}/>
 </div>;
}
