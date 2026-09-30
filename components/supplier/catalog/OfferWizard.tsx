"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetailStep from "./steps/ProductDetailStep";
import PickupLocationStep from "./steps/PickupLocationStep";
import { INITIAL_CATALOG_DRAFT, type CatalogDraft } from "@/lib/supplier-catalog/types";
import { buildOfferSchedule, formatTransactionDate, fromWibInput, normalizePriceTiers, toWibInput, type OfferScheduleInput } from "@/lib/transactions/schedule";

export interface SavedOfferDraft { id: string; revision: number; step: number; payload: Partial<CatalogDraft> & { schedule?: OfferScheduleInput }; published_batch_id?: string | null }
const field = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2";
const button = "min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50";
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function OfferWizard({ ownerId, initialDraft, savedDraft,copySourceId }: { ownerId: string; initialDraft?: Partial<CatalogDraft>; savedDraft?: SavedOfferDraft | null;copySourceId?:string }) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [id, setId] = useState(savedDraft?.id ?? "");
  const [revision, setRevision] = useState<number | null>(savedDraft?.revision ?? null);
  const [step, setStep] = useState(savedDraft?.step ?? 1);
  const [draft, setDraft] = useState<CatalogDraft>({ ...INITIAL_CATALOG_DRAFT, ...initialDraft, ...savedDraft?.payload, productPhoto: null });
  const [schedule, setSchedule] = useState<OfferScheduleInput>(savedDraft?.payload.schedule ?? { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" });
  const [previewNow] = useState(()=>new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [restored, setRestored] = useState(false);
  const key = `wesup:offer:${ownerId}${copySourceId?`:copy:${copySourceId}`:''}`;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!savedDraft) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) { const local = JSON.parse(stored); setDraft(d => ({ ...d, ...local.draft, productPhoto: null })); setSchedule(local.schedule); setStep(local.step); setId(local.id); setRevision(local.revision); setMessage("Isian terakhir dipulihkan. Foto yang belum tersimpan perlu dipilih kembali."); }
        } catch { /* Storage unavailable: server drafts remain usable. */ }
      }
      setRestored(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [key, savedDraft]);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(key, JSON.stringify({ id, revision, step, schedule, draft: { ...draft, productPhoto: null } })); } catch { /* Explicit server save still works. */ }
  }, [draft, schedule, step, id, revision, key, restored]);
  const change = (patch: Partial<CatalogDraft>) => { setDraft(d => ({ ...d, ...patch })); setReviewed(false); };
  const date = schedule.pickupStartsAt ? toWibInput(schedule.pickupStartsAt).slice(0, 10) : "";
  const start = schedule.pickupStartsAt ? toWibInput(schedule.pickupStartsAt).slice(11, 16) : "08:00";
  const end = schedule.pickupEndsAt ? toWibInput(schedule.pickupEndsAt).slice(11, 16) : "20:00";
  const dates = (d: string, s = start, e = end) => { setSchedule(old => ({ ...old, pickupStartsAt: d ? fromWibInput(`${d}T${s}`) : "", pickupEndsAt: d ? fromWibInput(`${d}T${e}`) : "" })); setReviewed(false); };
  let preview: ReturnType<typeof buildOfferSchedule> | null = null;
  try { preview = buildOfferSchedule(schedule, previewNow); } catch { /* Validation shown on continue. */ }
  const earliestOpening = schedule.openingMode === "scheduled" && schedule.scheduledOpensAt ? new Date(fromWibInput(schedule.scheduledOpensAt)).getTime() : Date.parse(previewNow);
  const earliestDate = Number.isFinite(earliestOpening) ? toWibInput(new Date(earliestOpening + (schedule.collectionDays + 1) * 86400000).toISOString()).slice(0, 10) : "";
  function validate(which: number) {
    if (which === 1 && (!draft.title.trim() || !draft.category || !draft.description.trim() || !draft.unit || !Number.isInteger(draft.capacityQuantity) || (draft.capacityQuantity ?? 0) < 1 || (!draft.productPhoto && !draft.productPhotoUrl))) throw new Error("Lengkapi nama, kategori, deskripsi, kapasitas, satuan, dan foto produk.");
    if (which === 2) { const tiers = normalizePriceTiers(draft.tiers); if (tiers.some(t => t.minimumQuantity > (draft.capacityQuantity ?? 0))) throw new Error("Ambang diskon tidak boleh melebihi kapasitas tersedia."); }
    if (which === 3) { buildOfferSchedule(schedule, new Date().toISOString()); if (!draft.pickupName.trim() || !draft.pickupAddress.trim() || draft.pickupLatitude === null || draft.pickupLongitude === null) throw new Error("Lengkapi lokasi pengambilan dan pin peta."); }
  }
  function next() { try { validate(step); setError(""); setStep(s => Math.min(4, s + 1)); heading.current?.focus(); } catch (e) { setError(e instanceof Error ? e.message : "Periksa isian."); } }
  async function save(publish = false) {
    setError(""); setMessage("");
    try {
      if (publish) { [1, 2, 3].forEach(validate); if (!reviewed) throw new Error("Periksa stok, harga, jadwal, dan komitmen melayani pengambilan."); }
      setBusy(true);
      const draftId = id || crypto.randomUUID(); setId(draftId);
      const form = new FormData(); form.set("id", draftId); form.set("step", String(step)); form.set("revision", revision === null ? "" : String(revision)); form.set("action", publish ? "publish" : "draft");
      form.set("payload", JSON.stringify({ ...draft, productPhoto: undefined, schedule }));
      if (draft.productPhoto) form.set("productPhoto", draft.productPhoto);
      const response = await fetch("/api/suppliers/offers", { method: "POST", body: form });
      const body = await response.json();
      // A validation failure may have saved a newer partial draft; retain its revision.
      if (body.item?.revision) { setRevision(body.item.revision); if (body.item.payload?.productPhotoUrl) change({ productPhotoUrl: body.item.payload.productPhotoUrl, productPhoto: null }); }
      if (!response.ok) throw new Error(body.error ?? "Draft belum tersimpan. Isian tetap tersedia di perangkat ini.");
      if (body.batchId) { localStorage.removeItem(key); router.push(`/supplier/batch/${body.batchId}`); }
      else { setMessage("Draft tersimpan"); router.replace(`/supplier/catalog/new?draft=${draftId}`); }
    } catch (e) { setError(e instanceof Error ? e.message : "Penyimpanan gagal. Coba kembali."); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-5">
    <ol aria-label="Langkah pembuatan penawaran" className="grid grid-cols-4 gap-2 text-center text-xs">{["Produk", "Harga", "Jadwal & lokasi", "Periksa"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`rounded-xl p-3 ${step === index + 1 ? "bg-blue-700 font-bold text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}. {label}</li>)}</ol>
    <fieldset disabled={busy} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
      {step === 1 && <ProductDetailStep simplified draft={draft} errors={{}} disabled={busy} headingRef={heading} onFieldChange={(name, value) => change({ [name]: value })} onTargetQuantityChange={() => {}} onCapacityQuantityChange={value => change({ capacityQuantity: value })} onUnitChange={unit => change({ unit })} onPhotoChange={productPhoto => change({ productPhoto })} />}
      {step === 2 && <><h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Harga dasar dan diskon jumlah</h2><p className="text-sm text-slate-600">Pesanan tetap berjalan dengan harga dasar jika ambang diskon belum tercapai.</p>{draft.tiers.map((tier, index) => <div key={index} className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><label className="text-sm">{index === 0 ? "Mulai 1 " + draft.unit : "Diskon mulai jumlah"}<input aria-label={`Mulai jumlah harga ${index + 1}`} className={field} type="number" min="1" step="1" disabled={index === 0} value={tier.minimumQuantity} onChange={e => change({ tiers: draft.tiers.map((t, i) => i === index ? { ...t, minimumQuantity: Number(e.target.value) } : t) })} /></label><label className="text-sm">Harga per {draft.unit} (Rp)<input aria-label={`Harga ${index === 0 ? "dasar" : index + 1}`} className={field} type="number" min="1" value={tier.pricePerUnit || ""} onChange={e => change({ tiers: draft.tiers.map((t, i) => i === index ? { ...t, pricePerUnit: Number(e.target.value) } : t) })} /></label>{index > 1 && <button type="button" className="text-left text-sm text-red-700" onClick={() => change({ tiers: draft.tiers.filter((_, i) => i !== index) })}>Hapus ambang ini</button>}</div>)}<button type="button" className={button} onClick={() => change({ tiers: [...draft.tiers, { tierNumber: draft.tiers.length + 1, minimumQuantity: draft.tiers.at(-1)!.minimumQuantity + 1, maximumQuantity: null, pricePerUnit: 0 }] })}>Tambah diskon jumlah</button></>}
      {step === 3 && <><h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Jadwal dan lokasi</h2><p className="text-sm text-slate-600">Buka saat diterbitkan. Pembayaran berlangsung 24 jam setelah batas ikut. Semua waktu dalam WIB.</p><label className="block text-sm font-semibold">Lama pengumpulan pesanan<select className={field} value={schedule.collectionDays} onChange={e => setSchedule(s => ({ ...s, collectionDays: Number(e.target.value) }))}>{[1, 2, 3, 7].map(d => <option key={d} value={d}>{d} hari</option>)}</select></label><details><summary className="cursor-pointer text-sm font-semibold">Pengaturan tambahan · buka terjadwal</summary><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={schedule.openingMode === "scheduled"} onChange={e => setSchedule(s => ({ ...s, openingMode: e.target.checked ? "scheduled" : "immediate" }))} />Buka pada waktu tertentu</label>{schedule.openingMode === "scheduled" && <label className="block text-sm">Waktu buka (WIB)<input type="datetime-local" className={field} value={schedule.scheduledOpensAt ? toWibInput(schedule.scheduledOpensAt) : ""} onChange={e => setSchedule(s => ({ ...s, scheduledOpensAt: fromWibInput(e.target.value) }))} /></label>}</details><label className="block text-sm font-semibold">Tanggal pengambilan (WIB)<input className={field} type="date" min={earliestDate} value={date} onChange={e => dates(e.target.value)} /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm">Mulai (WIB)<input className={field} type="time" min="06:00" max="18:00" value={start} onChange={e => dates(date, e.target.value, end)} /></label><label className="text-sm">Selesai (WIB)<input className={field} type="time" min="10:00" max="22:00" value={end} onChange={e => dates(date, start, e.target.value)} /></label></div><p className="text-xs text-slate-500">Durasi pengambilan 4–12 jam, dalam 06.00–22.00 WIB, sesudah batas bayar.</p><PickupLocationStep draft={draft} errors={{}} disabled={busy} headingRef={heading} onFieldChange={(name, value) => change({ [name]: value })} onCoordinateChange={point => change({ pickupLatitude: point.lat, pickupLongitude: point.lng })} /></>}
      {step === 4 && <><h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Periksa sebelum diterbitkan</h2><article className="rounded-xl border p-4"><h3 className="font-bold">{draft.title}</h3><p className="text-sm">{draft.description}</p><p className="mt-2">Harga dasar {money(draft.tiers[0].pricePerUnit)} / {draft.unit}</p><p className="text-sm">Kapasitas {draft.capacityQuantity} {draft.unit}. Diskon bergantung jumlah terkumpul.</p>{draft.tiers.slice(1).map((tier, i) => <p className="text-sm" key={i}>Mulai {tier.minimumQuantity} {draft.unit}: {money(tier.pricePerUnit)} / {draft.unit}</p>)}</article><dl className="space-y-3 text-sm">{preview && [["Buka penawaran", preview.registrationOpensAt], ["Batas ikut / mulai bayar", preview.registrationClosesAt], ["Batas bayar", preview.paymentClosesAt], ["Pengambilan mulai", preview.estimatedReadyAt], ["Pengambilan selesai", schedule.pickupEndsAt]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold">{formatTransactionDate(value)}</dd></div>)}<div><dt className="text-slate-500">Lokasi</dt><dd>{draft.pickupName} · {draft.pickupAddress}</dd></div></dl><p className="text-xs text-slate-500">Untuk buka langsung, waktu buka dihitung kembali saat penerbitan berhasil. Jadwal bayar tidak maju saat kapasitas penuh.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Saya sudah memeriksa harga, stok, lokasi, dan jadwal; saya akan menyiapkan barang dan melayani pengambilan pada rentang ini.</label></>}
    </fieldset>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{id&&<a className="mt-2 inline-block underline" href={`/supplier/catalog/new?draft=${id}`}>Buka versi Draft tersimpan untuk memeriksa hasil penyimpanan</a>}</div>}
    <p role="status" aria-live="polite" className="text-sm text-emerald-700">{busy ? "Menyimpan…" : message}</p>
    <div className="flex flex-wrap gap-3">{step > 1 && <button type="button" disabled={busy} className={button} onClick={() => setStep(s => s - 1)}>Kembali</button>}<button type="button" disabled={busy} className={button} onClick={() => void save()}>Simpan Draft</button>{step < 4 ? <button type="button" disabled={busy} className={`${button} bg-blue-700 text-white`} onClick={next}>Lanjut</button> : <button type="button" disabled={busy || !reviewed} className={`${button} bg-blue-700 text-white`} onClick={() => void save(true)}>Terbitkan penawaran</button>}</div>
  </div>;
}
