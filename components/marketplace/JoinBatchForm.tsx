"use client";

import { FormEvent, useState, useEffect } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/marketplace/api-repository";
import type { MarketplaceItem } from "@/lib/marketplace/types";

import { useRouter } from "next/navigation";
import { formatTransactionDate } from "@/lib/transactions/schedule";

interface ViewerLocation {
  latitude: number;
  longitude: number;
}

interface RegistrationResult {
  count: number;
  registrationId: string;
}

export interface JoinBatchFormProps {
  item: MarketplaceItem;
  consentGiven: boolean;
  viewerLocation?: ViewerLocation | null;
  onSuccess: (result: RegistrationResult) => void;
}

export default function JoinBatchForm({
  item,
  consentGiven,
  viewerLocation = null,
  onSuccess,
}: JoinBatchFormProps) {
  const router=useRouter();
  const [terms,setTerms]=useState(false);
  const earlyMinimum = item.earlyPayment?.proposal?.status === "pending" ? item.earlyPayment.proposal.minimumQuantity : item.earlyPayment?.originalMinimumQuantity ?? null;
  const [quantity, setQuantity] = useState<number | "">(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(()=>{ const timer=setTimeout(()=>{try{const stored=Number(sessionStorage.getItem(`wesup:join:${item.id}`));if(Number.isSafeInteger(stored)&&stored>0)setQuantity(stored);}catch{}},0);return()=>clearTimeout(timer);},[item.id]);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consentGiven || submitting || ((item.policyVersion===2 || item.earlyPayment?.proposal?.status === "pending" || earlyMinimum != null)&&!terms)) return;

    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) {
      setError("Masukkan jumlah porsi yang valid.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchId: item.id,
          quantity,
          consentAccepted:item.policyVersion===2 || earlyMinimum != null || item.earlyPayment?.proposal?.status === "pending" ? terms : undefined,
          consentSnapshot:item.policyVersion===2 || earlyMinimum != null || item.earlyPayment?.proposal?.status === "pending" ? {earlyPaymentMinimumQuantity:item.earlyPayment?.originalMinimumQuantity ?? null,earlyPaymentProposalId:item.earlyPayment?.proposal?.status === "pending" ? item.earlyPayment.proposal.id : null,earlyPaymentProposalRevision:item.earlyPayment?.proposal?.status === "pending" ? item.earlyPayment.proposal.revision : null,paymentOpeningPolicy:item.paymentOpeningPolicy??"fixed_cutoff",maximumUnitPrice:item.basePrice,unit:item.unit,pickupAddress:item.pickupAddress,paymentOpensAt:item.paymentOpensAt,paymentClosesAt:item.paymentClosesAt,pickupStartsAt:item.pickupStartsAt,pickupEndsAt:item.pickupEndsAt}:undefined,
          consentLat: viewerLocation?.latitude ?? null,
          consentLng: viewerLocation?.longitude ?? null,
        }),
      });

      if(response.status===401){router.push(`/login?role=umkm&returnTo=${encodeURIComponent(`/marketplace/${item.id}`)}`);return;}
      if (!response.ok) throw new Error(await readApiError(response));
      const result = (await response.json()) as Partial<RegistrationResult>;
      if (
        typeof result.count !== "number" ||
        typeof result.registrationId !== "string" ||
        result.registrationId.length === 0
      ) {
        throw new Error("Respons pendaftaran tidak valid.");
      }

      setSucceeded(true);
      if(item.policyVersion===2) {sessionStorage.removeItem(`wesup:join:${item.id}`);router.push(`/umkm/pesanan/${result.registrationId}`);}
      onSuccess({ count: result.count, registrationId: result.registrationId });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Pendaftaran gagal. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
        <p className="font-semibold text-emerald-800">Pendaftaran berhasil.</p>
        <p className="text-sm text-emerald-700">
          Pantau detail pesanan untuk jadwal pembayaran dan pengambilan.
        </p>
        <Link
          href="/umkm/pesanan"
          className="inline-flex w-fit items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Lihat Pesanan
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="join-batch-quantity" className="text-sm font-semibold text-slate-700">
          {item.policyVersion===2?`Jumlah (${item.unit ?? "pcs"})`:"Jumlah porsi"}
        </label>
        <input
          id="join-batch-quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(event) => {
            const raw = event.target.value;
            setQuantity(raw === "" ? "" : Number(raw));
            try {sessionStorage.setItem(`wesup:join:${item.id}`,raw);} catch {}
            setTerms(false);
          }}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {(item.policyVersion===2 || item.earlyPayment?.proposal?.status === "pending" || earlyMinimum != null) && <section className="space-y-3 rounded-xl border bg-blue-50 p-4 text-sm"><p>Jumlah: {quantity || 0} {item.unit}. Total maksimum: <strong>{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(quantity)*item.basePrice)}</strong></p><p>Estimasi saat ini: {new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(quantity)*item.currentTierPrice)}. Harga belum final.</p>{item.paymentOpeningPolicy==="capacity_or_cutoff"?<p>Pembayaran dibuka segera ketika kapasitas penuh, atau paling lambat {formatTransactionDate(item.paymentOpensAt)}. Batas bayar 24 jam sejak pengumpulan ditutup. Jadwal pengambilan tetap.</p>:<p>Bayar {formatTransactionDate(item.paymentOpensAt)} sampai {formatTransactionDate(item.paymentClosesAt)}.</p>}{earlyMinimum != null && <p>Supplier dapat menutup pendaftaran setelah terkumpul minimal {earlyMinimum} {item.unit}. Pembayaran berlangsung 24 jam sejak pendaftaran ditutup. Jadwal pengambilan tetap.</p>}{item.earlyPayment?.proposal?.status === "pending" && <p>Dengan bergabung, Anda menyetujui usulan pembukaan lebih awal revisi {item.earlyPayment.proposal.revision}. Seluruh peserta aktif harus setuju; supplier tetap mengonfirmasi pembukaan.</p>}<p>Ambil di {item.pickupAddress}, {formatTransactionDate(item.pickupStartsAt)} sampai {formatTransactionDate(item.pickupEndsAt)}.</p><label className="flex items-start gap-3"><input className="mt-1 size-5 shrink-0" type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/>Saya memahami harga dapat berubah sampai batas ikut; saya boleh batal tanpa penalti selama pengumpulan masih dibuka. {item.paymentOpeningPolicy === "capacity_or_cutoff" ? "Pengumpulan dapat ditutup lebih awal ketika kapasitas penuh. " : ""}Sesudahnya harga final terkunci dan saya wajib membayar. Tidak membayar dapat memicu peringatan, suspend 7 hari, lalu permanen. Tidak mengambil pada jadwal yang disetujui saat supplier siap membuat dana diberikan kepada supplier.</label></section>}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!consentGiven || submitting || ((item.policyVersion===2 || item.earlyPayment?.proposal?.status === "pending" || earlyMinimum != null)&&!terms)}
        className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
          consentGiven && !submitting
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "cursor-not-allowed bg-slate-200 text-slate-500"
        }`}
      >
        {submitting ? "Mendaftarkan…" : item.policyVersion===2 ? "Konfirmasi ikut pesanan" : "Daftar Sekarang"}
      </button>

      {!consentGiven ? (
        <p className="text-xs font-medium text-slate-500">
          Centang persetujuan lokasi pengambilan untuk mengaktifkan tombol daftar.
        </p>
      ) : null}
    </form>
  );
}
