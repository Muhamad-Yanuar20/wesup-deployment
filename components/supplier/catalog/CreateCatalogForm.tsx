"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import {
  INITIAL_CATALOG_DRAFT,
  type CatalogDraft,
  type CatalogDraftStep,
  type CatalogTierDraft,
  type FieldErrors,
} from "@/lib/supplier-catalog/types";
import CatalogStepper from "@/components/supplier/catalog/CatalogStepper";
import ProductDetailStep from "@/components/supplier/catalog/steps/ProductDetailStep";
import TierPricingStep from "@/components/supplier/catalog/steps/TierPricingStep";
import TimelineStep from "@/components/supplier/catalog/steps/TimelineStep";
import PickupLocationStep from "@/components/supplier/catalog/steps/PickupLocationStep";
import CatalogReviewStep from "@/components/supplier/catalog/steps/CatalogReviewStep";
import RecurringOptionField from "@/components/supplier/recurring/RecurringOptionField";

type SubmitPhase = "idle" | "publishing" | "saved";

export interface CreateCatalogFormProps {
  initialDraft?: CatalogDraft;
  locationLocked?: boolean;
  tiersLocked?: boolean;
  submitLabel?: string;
  productPhotoRequired?: boolean;
}

function validateStep(
  step: CatalogDraftStep,
  draft: CatalogDraft,
  productPhotoRequired = true,
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!draft.title.trim()) errors.title = "Nama produk wajib diisi.";
    if (!draft.category) errors.category = "Pilih kategori produk.";
    if (!draft.description.trim()) errors.description = "Deskripsi produk wajib diisi.";
    if (productPhotoRequired && !draft.productPhoto) errors.productPhoto = "Unggah foto produk.";
  }

  if (step === 2) {
    if (draft.tiers.length < 2) {
      errors.tiers = "Minimal 2 tier harga.";
    }
    for (let i = 0; i < draft.tiers.length; i++) {
      const tier = draft.tiers[i];
      if (tier.pricePerUnit <= 0) {
        errors[`tiers.${i}.pricePerUnit` as keyof FieldErrors] = `Harga Tier ${tier.tierNumber} wajib diisi.`;
      }
      if (i < draft.tiers.length - 1 && tier.maximumQuantity === null) {
        errors[`tiers.${i}.maximumQuantity` as keyof FieldErrors] = `Kuantitas maksimum Tier ${tier.tierNumber} wajib diisi.`;
      }
    }
    for (let i = 1; i < draft.tiers.length; i++) {
      if (draft.tiers[i].pricePerUnit >= draft.tiers[i - 1].pricePerUnit) {
        errors.tierInversion = "Harga tier harus menurun seiring kuantitas naik.";
        break;
      }
    }
    for (let i = 1; i < draft.tiers.length; i++) {
      const prevMax = draft.tiers[i - 1].maximumQuantity ?? Infinity;
      if (draft.tiers[i].minimumQuantity <= prevMax) {
        errors.tierOverlap = "Rentang kuota antar tier tidak boleh overlap.";
        break;
      }
    }
  }

  if (step === 3) {
    const fields = [
      "registrationOpensAt",
      "registrationClosesAt",
      "paymentOpensAt",
      "paymentClosesAt",
      "estimatedReadyAt",
    ] as const;
    for (const f of fields) {
      if (!draft[f]) {
        errors[f] = "Waktu ini wajib diisi.";
      }
    }
    const times = fields.map((f) => new Date(draft[f]).getTime());
    const allFilled = times.every((t) => !isNaN(t));
    if (allFilled) {
      for (let i = 1; i < times.length; i++) {
        if (times[i] <= times[i - 1]) {
          errors.timelineOrder = "Urutan waktu tidak logis. Pastikan setiap waktu lebih besar dari sebelumnya.";
          break;
        }
      }
    }
  }

  if (step === 4) {
    if (!draft.pickupName.trim()) errors.pickupName = "Nama lokasi wajib diisi.";
    if (!draft.pickupAddress.trim()) errors.pickupAddress = "Alamat wajib diisi.";
    if (draft.pickupLatitude === null || draft.pickupLongitude === null) {
      errors.pickupCoordinate = "Pin peta wajib dipilih. Klik pada peta untuk menandai lokasi.";
    }
  }

  return errors;
}

export default function CreateCatalogForm({
  initialDraft,
  locationLocked = false,
  tiersLocked = false,
  submitLabel,
  productPhotoRequired = true,
}: CreateCatalogFormProps = {}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CatalogDraft>(initialDraft ?? INITIAL_CATALOG_DRAFT);
  const [currentStep, setCurrentStep] = useState<CatalogDraftStep>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<CatalogDraftStep>(1);
  const pendingErrorFocusRef = useRef<FieldErrors | null>(null);

  const submitting = submitPhase !== "idle";

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;
    const errorToFocus = pendingErrorFocusRef.current;
    pendingErrorFocusRef.current = null;
    window.setTimeout(() => {
      if (errorToFocus) {
        focusFirstError(errorToFocus);
        return;
      }
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [currentStep]);

  const updateField = useCallback(
    (field: keyof CatalogDraft, value: string) => {
      setDraft((d) => ({ ...d, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
      setGlobalError(undefined);
    },
    [],
  );

  const updateTiers = useCallback((tiers: CatalogTierDraft[]) => {
    setDraft((d) => ({ ...d, tiers }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(next)) {
        if (key.startsWith("tiers.") || key === "tierOverlap" || key === "tierInversion") {
          delete next[key as keyof FieldErrors];
        }
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    if (submitting || currentStep === 1) return;
    setGlobalError(undefined);
    setCurrentStep((s) => (s - 1) as CatalogDraftStep);
  }, [currentStep, submitting]);

  const goNext = useCallback(() => {
    if (currentStep === 5 || submitting) return false;
    const stepErrors = validateStep(currentStep, draft, productPhotoRequired);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((e) => ({ ...e, ...stepErrors }));
      setGlobalError(undefined);
      focusFirstError(stepErrors);
      return false;
    }
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(next)) {
        if (!key.startsWith("tiers.") && key !== "tierOverlap" && key !== "tierInversion" && key !== "timelineOrder") {
          delete next[key as keyof FieldErrors];
        }
      }
      return next;
    });
    setGlobalError(undefined);
    setCurrentStep((s) => (s + 1) as CatalogDraftStep);
    return true;
  }, [currentStep, draft, submitting, productPhotoRequired]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (currentStep < 5) {
        goNext();
        return;
      }
      if (submitting) return;

      setSubmitPhase("publishing");
      window.setTimeout(() => {
        setSubmitPhase("saved");
      }, 1500);
    },
    [currentStep, goNext, submitting],
  );

  const handleSaveDraft = useCallback(() => {
    if (submitting) return;
    setSubmitPhase("saved");
  }, [submitting]);

  return (
    <>
      <CatalogStepper currentStep={currentStep} />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8 lg:p-10"
      >
        {globalError && (
          <div
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            role="alert"
          >
            {globalError}
          </div>
        )}

        {currentStep === 1 && (
          <ProductDetailStep
            draft={draft}
            errors={errors}
            disabled={submitting}
            headingRef={headingRef}
            onFieldChange={(field, value) => updateField(field, value)}
            onPhotoChange={(file) => {
              setDraft((d) => ({ ...d, productPhoto: file }));
              setErrors((e) => ({ ...e, productPhoto: undefined }));
            }}
          />
        )}
        {currentStep === 2 && (
          <TierPricingStep
            draft={draft}
            errors={errors}
            disabled={submitting}
            locked={tiersLocked}
            headingRef={headingRef}
            onTiersChange={updateTiers}
          />
        )}
        {currentStep === 3 && (
          <TimelineStep
            draft={draft}
            errors={errors}
            disabled={submitting}
            headingRef={headingRef}
            onFieldChange={(field, value) => updateField(field, value)}
          />
        )}
        {currentStep === 4 && (
          <PickupLocationStep
            draft={draft}
            errors={errors}
            disabled={submitting}
            locationLocked={locationLocked}
            headingRef={headingRef}
            onFieldChange={(field, value) => updateField(field, value)}
            onCoordinateChange={(coord: MapCoordinate) => {
              if (locationLocked) return;
              setDraft((d) => ({
                ...d,
                pickupLatitude: coord.lat,
                pickupLongitude: coord.lng,
              }));
              setErrors((e) => ({ ...e, pickupCoordinate: undefined }));
            }}
          />
        )}
        {currentStep === 5 && (
          <div className="space-y-6">
            <CatalogReviewStep draft={draft} headingRef={headingRef} />
            <RecurringOptionField
              recurring={draft.recurring}
              onEnabledChange={(enabled) => {
                setDraft((d) => ({
                  ...d,
                  recurring: { ...d.recurring, enabled },
                }));
              }}
              onFieldChange={(field, value) => {
                setDraft((d) => ({
                  ...d,
                  recurring: { ...d.recurring, [field]: value },
                }));
              }}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {currentStep === 5 && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Simpan Draft
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-56"
            >
              {submitPhase === "publishing" ? (
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : submitPhase === "saved" ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : currentStep === 5 ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              )}
              {submitPhase === "publishing"
                ? "Menerbitkan..."
                : submitPhase === "saved"
                  ? "Berhasil Disimpan!"
                  : currentStep === 5
                    ? (submitLabel ?? "Terbitkan Penawaran")
                    : "Lanjut"}
            </button>
          </div>
        </div>

        {currentStep === 5 && (
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Dengan menerbitkan, Anda menyetujui bahwa data penawaran akan tayang di marketplace Wesup.
          </p>
        )}
      </form>

      {/* Success state */}
      {submitPhase === "saved" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
          <h3 className="mt-3 text-lg font-bold text-emerald-900">
            {initialDraft
              ? "Perubahan berhasil disimpan!"
              : "Penawaran berhasil diterbitkan!"}
          </h3>
          <p className="mt-1 text-sm text-emerald-700">
            {initialDraft
              ? "Katalog Anda telah diperbarui."
              : "Katalog Anda sekarang tayang di marketplace dan dapat dilihat oleh UMKM."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/supplier/catalog")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Lihat Katalog Saya
          </button>
        </div>
      )}
    </>
  );
}

function focusFirstError(errors: FieldErrors) {
  const field = Object.keys(errors).find((key) => Boolean(errors[key as keyof FieldErrors]));
  if (!field) return;
  const targetId =
    field === "pickupCoordinate"
      ? "pickup-map"
      : field.startsWith("tiers.")
        ? field.replace("tiers.", "tier-")
        : field;
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target instanceof HTMLElement && target.matches("input, textarea, select")) target.focus();
}
