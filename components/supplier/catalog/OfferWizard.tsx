"use client";

import { validateEarlyPaymentTarget } from "@/lib/transactions/early-payment";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetailStep from "./steps/ProductDetailStep";
import PickupLocationStep from "./steps/PickupLocationStep";
import { INITIAL_CATALOG_DRAFT, type CatalogDraft, type FieldErrors } from "@/lib/supplier-catalog/types";
import { listOfferRecoveries, offerRecoveryScope, removeOfferRecoveries, type LocalOfferRecovery } from "@/lib/supplier-catalog/local-recovery";
import { buildOfferSchedule, formatTransactionDate, fromWibInput, normalizePriceTiers, toWibInput, type OfferScheduleInput } from "@/lib/transactions/schedule";

import { useToast } from "@/components/ui/GlobalToast";
import { Alert, Spinner } from "@/components/feedback";
import { feedbackError } from "@/lib/feedback/errors";

export interface SavedOfferDraft { id: string; revision: number; step: number; payload: Partial<CatalogDraft> & { schedule?: OfferScheduleInput }; published_batch_id?: string | null }
const field = "mt-2 min-h-11 w-full  border border-wesup-ink/15 bg-wesup-paper px-3 py-2";
const button = "min-h-11  border border-wesup-ink/15 px-4 py-2 font-semibold disabled:opacity-50";
function defaultMinimum(draft: CatalogDraft): CatalogDraft { return { ...draft, earlyPaymentMinimumQuantity: draft.earlyPaymentMinimumQuantity ?? draft.capacityQuantity }; }
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function OfferWizard({ ownerId, initialDraft, savedDraft,copySourceId }: { ownerId: string; initialDraft?: Partial<CatalogDraft>; savedDraft?: SavedOfferDraft | null;copySourceId?:string }) {
  const router = useRouter();
  const { toast } = useToast();
  const heading = useRef<HTMLHeadingElement>(null);
  const [id, setId] = useState(savedDraft?.id ?? "");
  const [revision, setRevision] = useState<number | null>(savedDraft?.revision ?? null);
  const [step, setStep] = useState(savedDraft?.step ?? 1);
  const [draft, setDraft] = useState<CatalogDraft>(() => defaultMinimum({ ...INITIAL_CATALOG_DRAFT, ...initialDraft, ...savedDraft?.payload, earlyPaymentMinimumQuantity: savedDraft?.payload.earlyPaymentMinimumQuantity ?? initialDraft?.earlyPaymentMinimumQuantity ?? savedDraft?.payload.capacityQuantity ?? initialDraft?.capacityQuantity ?? INITIAL_CATALOG_DRAFT.capacityQuantity, productPhoto: null }));
  const [schedule, setSchedule] = useState<OfferScheduleInput>(savedDraft?.payload.schedule ?? { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" });
  const [previewNow] = useState(()=>new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [edited, setEdited] = useState(false);
  const [recoveryId, setRecoveryId] = useState(savedDraft?.id ?? "");
  const [recoveries, setRecoveries] = useState<LocalOfferRecovery[]>([]);
  const migratedKey = useRef<string | null>(null);
  const published = useRef(false);
  const scope = offerRecoveryScope(ownerId, copySourceId);
  const key = recoveryId ? `${scope}:draft:${recoveryId}` : "";
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setRecoveries(listOfferRecoveries(localStorage, scope).filter(local => !savedDraft || local.id === savedDraft.id));
      } catch { setStorageError(true); }
      setRecoveryId(current => current || crypto.randomUUID());
      setInitialized(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [scope, savedDraft]);
  useEffect(() => {
    if (!initialized || !edited || !key || published.current) return;
    try {
      localStorage.setItem(key, JSON.stringify({ id, revision, step, schedule, updatedAt: Date.now(), draft: { ...draft, productPhoto: null } }));
      if (migratedKey.current && migratedKey.current !== key) localStorage.removeItem(migratedKey.current);
      migratedKey.current = null;
      queueMicrotask(() => setStorageError(false));
    } catch { queueMicrotask(() => setStorageError(true)); }
  }, [draft, schedule, step, id, revision, key, initialized, edited]);
  function resume(local: LocalOfferRecovery) {
    setDraft(defaultMinimum({ ...INITIAL_CATALOG_DRAFT, ...initialDraft, ...local.draft, earlyPaymentMinimumQuantity: local.draft.earlyPaymentMinimumQuantity ?? local.draft.capacityQuantity ?? initialDraft?.earlyPaymentMinimumQuantity ?? initialDraft?.capacityQuantity ?? INITIAL_CATALOG_DRAFT.capacityQuantity, productPhoto: null }));
    setSchedule(local.schedule);
    setStep(local.step);
    setId(local.id);
    setRevision(savedDraft?.id === local.id ? savedDraft.revision : local.revision);
    setRecoveryId(local.key.startsWith(`${scope}:draft:`) ? local.key.slice(`${scope}:draft:`.length) : local.id || crypto.randomUUID());
    migratedKey.current = local.key;
    setRecoveries(current => current.filter(candidate => candidate.key !== local.key));
    setEdited(true);
    setReviewed(false);
    setError("");
    setMessage("Draft dipulihkan. Foto yang belum tersimpan perlu dipilih kembali.");
  }
  const change = (patch: Partial<CatalogDraft>) => { setDraft(d => ({ ...d, ...patch, ...(patch.capacityQuantity !== undefined && d.earlyPaymentMinimumQuantity === d.capacityQuantity && patch.earlyPaymentMinimumQuantity === undefined ? { earlyPaymentMinimumQuantity: patch.capacityQuantity } : {}) })); setEdited(true); setReviewed(false); };
  const changeSchedule = (update: (current: OfferScheduleInput) => OfferScheduleInput) => {
    setSchedule(update); setEdited(true); setReviewed(false);
  };
  const date = schedule.pickupStartsAt ? toWibInput(schedule.pickupStartsAt).slice(0, 10) : "";
  const start = schedule.pickupStartsAt ? toWibInput(schedule.pickupStartsAt).slice(11, 16) : "08:00";
  const end = schedule.pickupEndsAt ? toWibInput(schedule.pickupEndsAt).slice(11, 16) : "20:00";
  const dates = (d: string, s = start, e = end) => { changeSchedule(old => ({ ...old, pickupStartsAt: d ? fromWibInput(`${d}T${s}`) : "", pickupEndsAt: d ? fromWibInput(`${d}T${e}`) : "" })); };
  let preview: ReturnType<typeof buildOfferSchedule> | null = null;
  try { preview = buildOfferSchedule(schedule, previewNow); } catch { /* Validation shown on continue. */ }
  const earliestOpening = schedule.openingMode === "scheduled" && schedule.scheduledOpensAt ? new Date(fromWibInput(schedule.scheduledOpensAt)).getTime() : Date.parse(previewNow);
  const earliestDate = Number.isFinite(earliestOpening) ? toWibInput(new Date(earliestOpening + (schedule.collectionDays + 1) * 86400000).toISOString()).slice(0, 10) : "";
  function validate(which: number) {
    if (which === 1) {
      const fields: FieldErrors = {};
      if (!draft.title.trim()) fields.title = "Isi nama produk.";
      if (!draft.category) fields.category = "Pilih kategori produk.";
      if (!draft.description.trim()) fields.description = "Isi deskripsi produk.";
      if (!draft.unit) fields.unit = "Pilih satuan produk.";
      if (!Number.isInteger(draft.capacityQuantity) || (draft.capacityQuantity ?? 0) < 1) fields.capacityQuantity = "Kapasitas harus berupa bilangan bulat minimal 1.";
      const minimumError = validateEarlyPaymentTarget(draft.earlyPaymentMinimumQuantity, draft.capacityQuantity ?? 0);
      if (minimumError) fields.earlyPaymentMinimumQuantity = minimumError;
      if (!draft.productPhoto && !draft.productPhotoUrl) fields.productPhoto = "Pilih foto produk.";
      setFieldErrors(fields);
      if (Object.keys(fields).length) {
        setStep(1);
        const ids: Record<string, string> = { title: "catalog-title", category: "catalog-category", description: "catalog-description", unit: "catalog-unit", capacityQuantity: "catalog-capacity-quantity", earlyPaymentMinimumQuantity: "catalog-early-payment-minimum", productPhoto: "business-photo" };
        setTimeout(() => document.getElementById(ids[Object.keys(fields)[0]])?.focus(), 0);
        throw new Error("Periksa isian yang ditandai.");
      }
    }
    if (which === 2) { const tiers = normalizePriceTiers(draft.tiers); if (tiers.some(t => t.minimumQuantity > (draft.capacityQuantity ?? 0))) throw new Error("Ambang diskon tidak boleh melebihi kapasitas tersedia."); }
    if (which === 3) { buildOfferSchedule(schedule, new Date().toISOString()); if (!draft.pickupName.trim() || !draft.pickupAddress.trim() || draft.pickupLatitude === null || draft.pickupLongitude === null) throw new Error("Lengkapi lokasi pengambilan dan pin peta."); }
  }
  function next() { try { validate(step); setError(""); setStep(s => Math.min(4, s + 1)); setEdited(true); heading.current?.focus(); } catch (e) { setError(e instanceof Error ? e.message : "Periksa isian."); } }
  async function save(publish = false) {
    setError(""); setMessage("");
    try {
      if (publish) { [1, 2, 3].forEach(validate); if (!reviewed) throw new Error("Periksa stok, harga, jadwal, dan komitmen melayani pengambilan."); }
      setBusy(true);
      const draftId = id || recoveryId || crypto.randomUUID(); setId(draftId); setRecoveryId(draftId); setEdited(true);
      const form = new FormData(); form.set("id", draftId); form.set("step", String(step)); form.set("revision", revision === null ? "" : String(revision)); form.set("action", publish ? "publish" : "draft");
      form.set("payload", JSON.stringify({ ...draft, productPhoto: undefined, schedule }));
      if (draft.productPhoto) form.set("productPhoto", draft.productPhoto);
      const response = await fetch("/api/suppliers/offers", { method: "POST", body: form });
      const body = await response.json();
      // A validation failure may have saved a newer partial draft; retain its revision.
      if (body.item?.revision) { setRevision(body.item.revision); if (body.item.payload?.productPhotoUrl) change({ productPhotoUrl: body.item.payload.productPhotoUrl, productPhoto: null }); }
      if (!response.ok) throw new Error(body.error ?? "Draft belum tersimpan. Isian tetap tersedia di perangkat ini.");
      if (body.batchId) {
        published.current = true;
        try { localStorage.removeItem(key); removeOfferRecoveries(localStorage, ownerId, draftId); } catch { /* Navigation must still succeed if storage is unavailable. */ }
        toast("Penawaran diterbitkan.", "success");
        router.push(`/supplier/batch/${body.batchId}`);
      }
      else { setMessage("Draft tersimpan"); router.replace(`/supplier/catalog/new?draft=${draftId}`); }
    } catch (e) { setError(feedbackError(e, "Hasil penyimpanan belum terkonfirmasi. Periksa draft tersimpan sebelum mengirim ulang.")); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-5">{storageError && <Alert tone="warning">Isian belum dapat disimpan di perangkat. Gunakan Simpan Draft untuk menyimpan ke akun.</Alert>}
    {recoveries.length > 0 && <section aria-label="Draft di perangkat ini" className=" border border-wesup-ink/20 bg-wesup-paper-sub p-4">
      <h2 className="font-semibold text-wesup-ink">Ada draft yang belum selesai</h2>
      <p className="mt-1 text-sm text-wesup-ink-sub">{savedDraft ? "Draft tersimpan sedang dibuka. Pilih isian perangkat jika ingin memulihkan perubahan lokal." : "Form ini dimulai dari awal. Pilih draft jika ingin melanjutkan isian sebelumnya."}</p>
      <ul className="mt-3 space-y-2">{recoveries.map(local => <li key={local.key} className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-wesup-ink">{local.draft.title || "Penawaran tanpa nama"}</span>
        <button type="button" disabled={busy} className={`${button} bg-wesup-paper text-wesup-ink`} onClick={() => resume(local)} aria-label={`Lanjutkan Draft ${local.draft.title || "Penawaran tanpa nama"}`}>Lanjutkan Draft</button>
      </li>)}</ul>
    </section>}
    <ol aria-label="Langkah pembuatan penawaran" className="grid grid-cols-4 gap-2 text-center text-xs">{["Produk", "Harga", "Jadwal & lokasi", "Periksa"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={` p-3 ${step === index + 1 ? "bg-wesup-ink font-bold text-wesup-paper" : "bg-wesup-paper-sub text-wesup-ink-sub"}`}>{index + 1}. {label}</li>)}</ol>
    <fieldset disabled={busy} className="space-y-6  border border-wesup-ink/15 bg-wesup-paper p-5">
      {step === 1 && <ProductDetailStep simplified draft={draft} errors={fieldErrors} disabled={busy} headingRef={heading} onFieldChange={(name, value) => change({ [name]: value })} onEarlyPaymentMinimumChange={value => change({ earlyPaymentMinimumQuantity: value })} onTargetQuantityChange={() => {}} onCapacityQuantityChange={value => change({ capacityQuantity: value })} onUnitChange={unit => change({ unit })} onPhotoChange={productPhoto => change({ productPhoto })} />}
      {step === 2 && <><h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Harga dasar dan diskon jumlah</h2><p className="text-sm text-wesup-ink-sub">Pesanan tetap berjalan dengan harga dasar jika ambang diskon belum tercapai.</p>{draft.tiers.map((tier, index) => <div key={index} className="grid grid-cols-2 gap-3  bg-wesup-paper p-3"><label className="text-sm">{index === 0 ? "Mulai 1 " + draft.unit : "Diskon mulai jumlah"}<input aria-label={`Mulai jumlah harga ${index + 1}`} className={field} type="number" min="1" step="1" disabled={index === 0} value={tier.minimumQuantity} onChange={e => change({ tiers: draft.tiers.map((t, i) => i === index ? { ...t, minimumQuantity: Number(e.target.value) } : t) })} /></label><label className="text-sm">Harga per {draft.unit} (Rp)<input aria-label={`Harga ${index === 0 ? "dasar" : index + 1}`} className={field} type="number" min="1" value={tier.pricePerUnit || ""} onChange={e => change({ tiers: draft.tiers.map((t, i) => i === index ? { ...t, pricePerUnit: Number(e.target.value) } : t) })} /></label>{index > 1 && <button type="button" className="text-left text-sm text-wesup-red" onClick={() => change({ tiers: draft.tiers.filter((_, i) => i !== index) })}>Hapus ambang ini</button>}</div>)}<button type="button" className={button} onClick={() => change({ tiers: [...draft.tiers, { tierNumber: draft.tiers.length + 1, minimumQuantity: draft.tiers.at(-1)!.minimumQuantity + 1, maximumQuantity: null, pricePerUnit: 0 }] })}>Tambah diskon jumlah</button></>}
      {step === 3 && <><h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Jadwal dan lokasi</h2><p className="text-sm text-wesup-ink-sub">Buka saat diterbitkan. Supplier dapat membuka pembayaran setelah target minimum tercapai. Pembayaran juga dibuka otomatis ketika kapasitas penuh atau batas ikut tiba, lalu berlangsung 24 jam sejak penutupan. Semua waktu dalam WIB.</p><label className="block text-sm font-semibold">Lama pengumpulan pesanan<select className={field} value={schedule.collectionDays} onChange={e => changeSchedule(s => ({ ...s, collectionDays: Number(e.target.value) }))}>{[1, 2, 3, 7].map(d => <option key={d} value={d}>{d} hari</option>)}</select></label><details><summary className="cursor-pointer text-sm font-semibold">Pengaturan tambahan · buka terjadwal</summary><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={schedule.openingMode === "scheduled"} onChange={e => changeSchedule(s => ({ ...s, openingMode: e.target.checked ? "scheduled" : "immediate" }))} />Buka pada waktu tertentu</label>{schedule.openingMode === "scheduled" && <label className="block text-sm">Waktu buka (WIB)<input type="datetime-local" className={field} value={schedule.scheduledOpensAt ? toWibInput(schedule.scheduledOpensAt) : ""} onChange={e => changeSchedule(s => ({ ...s, scheduledOpensAt: fromWibInput(e.target.value) }))} /></label>}</details><label className="block text-sm font-semibold">Tanggal pengambilan (WIB)<input className={field} type="date" min={earliestDate} value={date} onChange={e => dates(e.target.value)} /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm">Mulai (WIB)<input className={field} type="time" min="06:00" max="18:00" value={start} onChange={e => dates(date, e.target.value, end)} /></label><label className="text-sm">Selesai (WIB)<input className={field} type="time" min="10:00" max="22:00" value={end} onChange={e => dates(date, start, e.target.value)} /></label></div><p className="text-xs text-wesup-ink-sub">Durasi pengambilan 4–12 jam, dalam 06.00–22.00 WIB, sesudah batas bayar.</p><PickupLocationStep draft={draft} errors={fieldErrors} disabled={busy} headingRef={heading} onFieldChange={(name, value) => change({ [name]: value })} onCoordinateChange={point => change({ pickupLatitude: point.lat, pickupLongitude: point.lng })} /></>}
      {step === 4 && <><h2 ref={heading} tabIndex={-1} className="text-xl font-bold">Periksa sebelum diterbitkan</h2><article className=" border p-4"><h3 className="font-bold">{draft.title}</h3><p className="text-sm">{draft.description}</p><p className="mt-2">Harga dasar {money(draft.tiers[0].pricePerUnit)} / {draft.unit}</p><p className="text-sm">Kapasitas {draft.capacityQuantity} {draft.unit}. Target minimum pembukaan lebih awal {draft.earlyPaymentMinimumQuantity} {draft.unit}. Diskon bergantung jumlah terkumpul.</p>{draft.tiers.slice(1).map((tier, i) => <p className="text-sm" key={i}>Mulai {tier.minimumQuantity} {draft.unit}: {money(tier.pricePerUnit)} / {draft.unit}</p>)}</article><dl className="space-y-3 text-sm">{preview && [["Buka penawaran", preview.registrationOpensAt], ["Batas ikut paling lambat", preview.registrationClosesAt], ["Batas bayar", preview.paymentClosesAt], ["Pengambilan mulai", preview.estimatedReadyAt], ["Pengambilan selesai", schedule.pickupEndsAt]].map(([label, value]) => <div key={label}><dt className="text-wesup-ink-sub">{label}</dt><dd className="font-semibold">{formatTransactionDate(value)}</dd></div>)}<div><dt className="text-wesup-ink-sub">Lokasi</dt><dd>{draft.pickupName} · {draft.pickupAddress}</dd></div></dl><p className="text-xs text-wesup-ink-sub">Untuk buka langsung, waktu buka dihitung kembali saat penerbitan berhasil. Supplier dapat menutup pendaftaran setelah target minimum {draft.earlyPaymentMinimumQuantity} {draft.unit} tercapai. Jika kapasitas penuh, pengumpulan ditutup otomatis. Pembayaran berlangsung 24 jam sejak penutupan aktual. Harga terkunci dan pembatalan ditutup; jadwal pengambilan tetap.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Saya sudah memeriksa harga, stok, lokasi, dan jadwal; saya akan menyiapkan barang dan melayani pengambilan pada rentang ini.</label></>}
    </fieldset>
    {error && <div role="alert" className=" bg-wesup-paper p-3 text-sm text-wesup-red"><p>{error}</p>{id&&<a className="mt-2 inline-block underline" href={`/supplier/catalog/new?draft=${id}`}>Buka versi Draft tersimpan untuk memeriksa hasil penyimpanan</a>}</div>}
    <p role="status" aria-live="polite" className="text-sm text-wesup-ink">{busy ? <span className="inline-flex items-center gap-2 text-wesup-ink-sub"><Spinner />Menyimpan…</span> : message}</p>
    <div className="flex flex-wrap gap-3">{step > 1 && <button type="button" disabled={busy} className={button} onClick={() => { setStep(s => s - 1); setEdited(true); }}>Kembali</button>}<button type="button" disabled={busy} className={button} onClick={() => void save()}>Simpan Draft</button>{step < 4 ? <button type="button" disabled={busy} className={`${button} bg-wesup-ink text-wesup-paper`} onClick={next}>Lanjut</button> : <button type="button" disabled={busy || !reviewed} className={`${button} bg-wesup-ink text-wesup-paper`} onClick={() => void save(true)}>Terbitkan penawaran</button>}</div>
  </div>;
}
