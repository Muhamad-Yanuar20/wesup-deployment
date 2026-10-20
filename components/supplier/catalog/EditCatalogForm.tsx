"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supplierBatchApiRepository } from "@/lib/supplier-catalog/api-repository";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";
import { isTierSchemeLocked } from "@/lib/supplier-catalog/lock";
import { ContentSkeleton } from "@/components/feedback";
import PublishedOfferEditor from "./PublishedOfferEditor";
import CreateCatalogForm from "@/components/supplier/catalog/CreateCatalogForm";

function batchToDraft(batch: SupplierBatchDetail): CatalogDraft {
  return {
    title: batch.title,
    category: batch.category,
    description: batch.description,
    targetQuantity: batch.targetQuantity,
    capacityQuantity: batch.capacityQuantity ?? batch.targetQuantity,
    unit: batch.unit ?? "pcs",
    paymentWindowHours: batch.paymentWindowHours ?? 24,
    productPhoto: null,
    productPhotoUrl: batch.imageUrl.startsWith("http") ? batch.imageUrl : null,
    tiers: batch.tiers.map((t) => ({
      tierNumber: t.tierNumber,
      minimumQuantity: t.minimumQuantity,
      maximumQuantity: t.maximumQuantity,
      pricePerUnit: t.pricePerUnit,
    })),
    registrationOpensAt: batch.timeline.registrationOpensAt.slice(0, 16),
    registrationClosesAt: batch.timeline.registrationClosesAt.slice(0, 16),
    paymentOpensAt: batch.timeline.paymentOpensAt.slice(0, 16),
    paymentClosesAt: batch.timeline.paymentClosesAt.slice(0, 16),
    estimatedReadyAt: batch.timeline.estimatedReadyAt.slice(0, 16),
    pickupName: batch.pickup.name,
    pickupAddress: batch.pickup.address,
    pickupLatitude: batch.pickup.latitude,
    pickupLongitude: batch.pickup.longitude,
    recurring: {
      enabled: false,
      name: "",
      intervalDays: 7,
      daysOfWeek: [],
    },
  };
}

type LoadPhase = "idle" | "loading" | "success" | "error" | "not-found" | "read-only";

const readOnlyStatusLabel: Partial<Record<SupplierBatchStatus, string>> = {
  CLOSED: "Selesai",
  CANCELLED_BY_SUPPLIER: "Dibatalkan pemasok",
  TAKEDOWN: "Diturunkan Admin",
  COMPLETED: "Selesai",
};

export default function EditCatalogForm() {
  const params = useParams<{ id: string }>();
  const batchId = params.id;

  const [retry, setRetry] = useState(0);
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [initialDraft, setInitialDraft] = useState<CatalogDraft | null>(null);
  const [batchStatus, setBatchStatus] = useState<SupplierBatchStatus | null>(null);
  const [policyVersion,setPolicyVersion]=useState(1);
  const [commercialLocked,setCommercialLocked]=useState(false);
  const [locationLocked, setLocationLocked] = useState(false);
  const [tiersLocked, setTiersLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    supplierBatchApiRepository
      .getById(batchId, { signal: controller.signal })
      .then((batch) => {
        if (!batch) {
          setPhase("not-found");
          return;
        }
        if (batch.status !== "DRAFT" && batch.status !== "PUBLISHED") {
          setError(`${readOnlyStatusLabel[batch.status] ?? "Katalog"} tidak dapat diedit.`);
          setPhase("read-only");
          return;
        }
        const draft=batchToDraft(batch);
        if(batch.policyVersion===2){draft.registrationOpensAt=batch.timeline.registrationOpensAt;draft.registrationClosesAt=batch.timeline.registrationClosesAt;draft.paymentOpensAt=batch.timeline.paymentOpensAt;draft.paymentClosesAt=batch.timeline.paymentClosesAt;draft.estimatedReadyAt=batch.timeline.estimatedReadyAt;}
        setInitialDraft(draft);
        setPolicyVersion(batch.policyVersion??1);setCommercialLocked(batch.commercialLocked??false);
        setBatchStatus(batch.status);
        setLocationLocked(batch.participantCount > 0);
        setTiersLocked(isTierSchemeLocked(batch.participantCount));
        setPhase("success");
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Gagal memuat data katalog.");
        setPhase("error");
      });

    return () => controller.abort();
  }, [batchId, retry]);

  if (phase === "loading") return <ContentSkeleton label="Memuat penawaran…" variant="form" />;

  if (phase === "not-found") {
    return (
      <div className=" border border-wesup-ink/15 bg-wesup-paper p-8 text-center ">
        <h2 className="text-lg font-bold text-wesup-ink">Katalog tidak ditemukan</h2>
        <p className="mt-2 text-sm text-wesup-ink-sub">ID katalog: {batchId}</p>
        <Link
          href="/supplier/catalog"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-wesup-ink hover:text-wesup-ink"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar katalog
        </Link>
      </div>
    );
  }

  if (phase === "read-only") {
    return (
      <div className=" border border-wesup-ink/15 bg-wesup-paper p-8 text-center ">
        <AlertCircle className="mx-auto h-6 w-6 text-wesup-ink-sub" />
        <h2 className="mt-3 text-lg font-bold text-wesup-ink">Katalog hanya dapat dibaca</h2>
        <p className="mt-2 text-sm text-wesup-ink-sub">{error ?? "Status katalog ini tidak mengizinkan perubahan."}</p>
        <Link
          href={`/supplier/batch/${batchId}`}
          className="mt-4 inline-flex items-center gap-2  bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper hover:bg-wesup-red"
        >
          <ArrowLeft size={16} />
          Kembali ke detail katalog
        </Link>
      </div>
    );
  }

  if (phase === "error" || !initialDraft) {
    return (
      <div className=" border border-wesup-red/40 bg-wesup-paper p-8 text-center ">
        <AlertCircle className="mx-auto h-6 w-6 text-wesup-red" />
        <h2 className="mt-3 text-lg font-bold text-wesup-ink">Gagal memuat katalog</h2>
        <p className="mt-1 text-sm text-wesup-red">{error ?? "Terjadi kesalahan."}</p>
        <button
          type="button"
          onClick={() => setRetry(value => value + 1)}
          className="mt-4  bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper hover:bg-wesup-red"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if(policyVersion===2&&initialDraft)return <PublishedOfferEditor batchId={batchId} initialDraft={initialDraft} locked={commercialLocked}/>;
  return (
    <>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/supplier/batch/${batchId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-wesup-ink-sub hover:text-wesup-ink"
        >
          <ArrowLeft size={16} />
          Kembali ke detail katalog
        </Link>
      </div>

      {/* Location lock notice */}
      {locationLocked && (
        <div className="mb-6 flex items-start gap-3  border border-wesup-ink/15 bg-wesup-paper p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-wesup-ink" />
          <div className="text-sm text-wesup-ink">
            <p className="font-semibold">Lokasi terkunci</p>
            <p className="mt-1">
              Penawaran ini sudah memiliki peserta terdaftar. Lokasi pengambilan tidak dapat diubah. Detail lainnya tetap bisa diedit.
            </p>
          </div>
        </div>
      )}

      {/* Tier lock notice */}
      {tiersLocked && (
        <div className="mb-6 flex items-start gap-3  border border-wesup-ink/15 bg-wesup-paper p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-wesup-ink" />
          <div className="text-sm text-wesup-ink">
            <p className="font-semibold">Skema harga terkunci</p>
            <p className="mt-1">
              Penawaran ini sudah memiliki peserta terdaftar. Skema harga tier tidak dapat diubah. Buat penawaran baru jika ingin mengubah harga.
            </p>
          </div>
        </div>
      )}

      <CreateCatalogForm
        initialDraft={initialDraft}
        batchId={batchId}
        submitAction={batchStatus === "DRAFT" ? "publish" : "draft"}
        locationLocked={locationLocked}
        tiersLocked={tiersLocked}
        productPhotoRequired={false}
        submitLabel={batchStatus === "DRAFT" ? "Terbitkan Penawaran" : "Simpan Perubahan"}
      />
    </>
  );
}
