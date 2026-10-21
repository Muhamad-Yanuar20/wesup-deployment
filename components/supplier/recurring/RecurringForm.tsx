"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  LoaderCircle,
  MapPin,
  Minus,
  Package,
  Plus,
  Save,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  INITIAL_RECURRING_DRAFT,
  type DayOfWeek,
  type FieldErrors,
  type RecurringConfigDraft,
  type RecurringDraftStep,
  type RecurringTierTemplate,
} from "@/lib/supplier-recurring/types";
import {
  initialRecurringFormState,
  recurringFormReducer,
} from "@/lib/supplier-recurring/state";
import RecurringStepper from "@/components/supplier/recurring/RecurringStepper";
import RecurringBatchPreviewCard from "@/components/supplier/recurring/RecurringBatchPreview";
import type { RecurringBatchPreview } from "@/lib/supplier-recurring/types";

function validateStep(
  step: RecurringDraftStep,
  draft: RecurringConfigDraft,
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!draft.name.trim()) errors.name = "Nama jadwal wajib diisi.";
    if (draft.intervalDays < 1) errors.intervalDays = "Interval minimal 1 hari.";
    if (draft.daysOfWeek.length === 0 && draft.intervalDays > 1) {
      errors.daysOfWeek = "Pilih minimal satu hari dalam seminggu.";
    }
  }

  if (step === 2) {
    if (!draft.templateTitle.trim()) errors.templateTitle = "Nama produk wajib diisi.";
    if (!draft.templateCategory) errors.templateCategory = "Pilih kategori produk.";
    if (!draft.templateDescription.trim()) errors.templateDescription = "Deskripsi produk wajib diisi.";
    if (draft.templateTiers.length < 2) errors.templateTiers = "Minimal 2 tier harga.";
    for (let i = 0; i < draft.templateTiers.length; i++) {
      const tier = draft.templateTiers[i];
      if (tier.pricePerUnit <= 0) {
        errors[`templateTiers.${i}.pricePerUnit` as keyof FieldErrors] =
          `Harga Tier ${tier.tierNumber} wajib diisi.`;
      }
      if (i < draft.templateTiers.length - 1 && tier.maximumQuantity === null) {
        errors[`templateTiers.${i}.maximumQuantity` as keyof FieldErrors] =
          `Kuantitas maksimum Tier ${tier.tierNumber} wajib diisi.`;
      }
    }
    for (let i = 1; i < draft.templateTiers.length; i++) {
      if (draft.templateTiers[i].pricePerUnit >= draft.templateTiers[i - 1].pricePerUnit) {
        errors.templateTierInversion = "Harga tier harus menurun seiring kuantitas naik.";
        break;
      }
    }
    for (let i = 1; i < draft.templateTiers.length; i++) {
      const prevMax = draft.templateTiers[i - 1].maximumQuantity ?? Infinity;
      if (draft.templateTiers[i].minimumQuantity <= prevMax) {
        errors.templateTierOverlap = "Rentang kuota antar tier tidak boleh overlap.";
        break;
      }
    }
    if (!draft.templatePickupName.trim()) errors.templatePickupName = "Nama lokasi wajib diisi.";
    if (!draft.templatePickupAddress.trim()) errors.templatePickupAddress = "Alamat wajib diisi.";
    if (draft.templatePickupLatitude === null || draft.templatePickupLongitude === null) {
      errors.templateCoordinate = "Pin peta wajib dipilih.";
    }
  }

  return errors;
}

function buildPreview(draft: RecurringConfigDraft): RecurringBatchPreview {
  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setDate(baseDate.getDate() + draft.intervalDays);

  const opensAt = new Date(baseDate);
  opensAt.setHours(1, 0, 0, 0);

  const closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + 7);
  closesAt.setHours(10, 0, 0, 0);

  const payOpens = new Date(closesAt);
  payOpens.setSeconds(1);

  const payCloses = new Date(payOpens);
  payCloses.setDate(payCloses.getDate() + 1);
  payCloses.setHours(8, 0, 0, 0);

  const readyAt = new Date(payCloses);
  readyAt.setDate(readyAt.getDate() + 3);
  readyAt.setHours(2, 0, 0, 0);

  return {
    configId: "preview",
    configName: draft.name,
    templateTitle: draft.templateTitle || "Nama Produk",
    category: (draft.templateCategory || "Makanan Siap Saji") as RecurringBatchPreview["category"],
    estimatedRegistrationOpensAt: opensAt.toISOString(),
    estimatedRegistrationClosesAt: closesAt.toISOString(),
    estimatedPaymentOpensAt: payOpens.toISOString(),
    estimatedPaymentClosesAt: payCloses.toISOString(),
    estimatedReadyAt: readyAt.toISOString(),
    tiers: draft.templateTiers,
    pickupName: draft.templatePickupName || "Lokasi Pengambilan",
    pickupAddress: draft.templatePickupAddress || "Alamat lokasi",
  };
}

export default function RecurringForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<RecurringConfigDraft>(INITIAL_RECURRING_DRAFT);
  const [currentStep, setCurrentStep] = useState<RecurringDraftStep>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const [formState, formDispatch] = useReducer(
    recurringFormReducer,
    initialRecurringFormState,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<RecurringDraftStep>(1);

  const submitting = formState.submitPhase !== "idle";

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;
    window.setTimeout(() => {
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [currentStep]);

  const updateField = useCallback(
    (field: keyof RecurringConfigDraft, value: string | number | boolean | DayOfWeek[]) => {
      setDraft((d) => ({ ...d, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
      setGlobalError(undefined);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (submitting || currentStep === 1) return;
    setGlobalError(undefined);
    setCurrentStep((s) => (s - 1) as RecurringDraftStep);
  }, [currentStep, submitting]);

  const goNext = useCallback(() => {
    if (currentStep === 3 || submitting) return false;
    const stepErrors = validateStep(currentStep, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((e) => ({ ...e, ...stepErrors }));
      setGlobalError(undefined);
      focusFirstError(stepErrors);
      return false;
    }
    setErrors({});
    setGlobalError(undefined);
    setCurrentStep((s) => (s + 1) as RecurringDraftStep);
    return true;
  }, [currentStep, draft, submitting]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (currentStep < 3) {
        goNext();
        return;
      }
      if (submitting) return;

      formDispatch({ type: "submitStarted" });
      window.setTimeout(() => {
        formDispatch({ type: "submitSucceeded" });
      }, 1500);
    },
    [currentStep, goNext, submitting, formDispatch],
  );

  const handleSaveDraft = useCallback(() => {
    if (submitting) return;
    formDispatch({ type: "submitSucceeded" });
  }, [submitting, formDispatch]);

  const addTier = useCallback(() => {
    setDraft((d) => {
      const lastTier = d.templateTiers.at(-1);
      const newTierNumber = (lastTier?.tierNumber ?? 0) + 1;
      const newMin = (lastTier?.maximumQuantity ?? 0) + 1;
      return {
        ...d,
        templateTiers: [
          ...d.templateTiers,
          { tierNumber: newTierNumber, minimumQuantity: newMin, maximumQuantity: null, pricePerUnit: 0 },
        ],
      };
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setDraft((d) => ({
      ...d,
      templateTiers: d.templateTiers.filter((_, i) => i !== index).map((t, i) => ({
        ...t,
        tierNumber: i + 1,
      })),
    }));
  }, []);

  const updateTier = useCallback(
    (index: number, field: keyof RecurringTierTemplate, value: number | null) => {
      setDraft((d) => ({
        ...d,
        templateTiers: d.templateTiers.map((t, i) =>
          i === index ? { ...t, [field]: value } : t,
        ),
      }));
      setErrors((e) => {
        const next = { ...e };
        const key = `templateTiers.${index}.${field}` as keyof FieldErrors;
        delete next[key];
        return next;
      });
    },
    [],
  );

  const toggleDay = useCallback((day: DayOfWeek) => {
    setDraft((d) => ({
      ...d,
      daysOfWeek: d.daysOfWeek.includes(day)
        ? d.daysOfWeek.filter((d) => d !== day)
        : [...d.daysOfWeek, day].sort((a, b) => a - b),
    }));
    setErrors((e) => ({ ...e, daysOfWeek: undefined }));
  }, []);

  const preview = buildPreview(draft);
  const lowestPrice = draft.templateTiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = draft.templateTiers.at(0)?.pricePerUnit ?? 0;

  return (
    <>
      <RecurringStepper currentStep={currentStep} />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6  border border-wesup-ink/15 bg-wesup-paper p-5   sm:p-8 lg:p-10"
      >
        {globalError && (
          <div
            className="mb-6  border border-wesup-red/40 bg-wesup-paper px-4 py-3 text-sm font-medium text-wesup-red"
            role="alert"
          >
            {globalError}
          </div>
        )}

        {/* STEP 1: Jadwal & Interval */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-wesup-ink outline-none"
            >
              Jadwal & Interval
            </h2>
            <p className="text-sm text-wesup-ink-sub">
              Atur seberapa sering penawaran akan tayang secara otomatis.
            </p>

            {errors.name && (
              <div className=" border border-wesup-ink/20 bg-wesup-paper-sub p-4" role="alert">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-wesup-ink-sub" />
                  <p className="text-sm text-wesup-ink">{errors.name}</p>
                </div>
              </div>
            )}

            {/* Nama Jadwal */}
            <div className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
              <span className="mt-1 shrink-0">
                <Sparkles size={20} className="text-wesup-red" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="recurring-name" className="text-sm font-semibold text-wesup-ink">
                  Nama Jadwal <span className="text-wesup-red">*</span>
                </label>
                <p className="text-xs text-wesup-ink-sub">
                  Contoh: &quot;Beras Rojolele Mingguan&quot;
                </p>
                <input
                  id="recurring-name"
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  disabled={submitting}
                  placeholder="Masukkan nama jadwal..."
                  className="mt-2 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper"
                />
              </div>
            </div>

            {/* Interval */}
            <div className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
              <span className="mt-1 shrink-0">
                <Clock size={20} className="text-wesup-ink-sub" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="recurring-interval" className="text-sm font-semibold text-wesup-ink">
                  Interval Pengulangan <span className="text-wesup-red">*</span>
                </label>
                <p className="text-xs text-wesup-ink-sub">
                  Berapa hari antara setiap batch yang di-generate.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="recurring-interval"
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={draft.intervalDays}
                    onChange={(e) => updateField("intervalDays", Number(e.target.value) || 1)}
                    disabled={submitting}
                    className="w-24  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper"
                  />
                  <span className="text-sm text-wesup-ink-sub">hari</span>
                </div>
                {errors.intervalDays && (
                  <p className="mt-1 text-xs text-wesup-red">{errors.intervalDays}</p>
                )}
              </div>
            </div>

            {/* Days of Week */}
            {draft.intervalDays > 1 && (
              <div className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
                <span className="mt-1 shrink-0">
                  <Calendar size={20} className="text-wesup-ink-sub" />
                </span>
                <div className="min-w-0 flex-1">
                  <label className="text-sm font-semibold text-wesup-ink">
                    Hari Tayang
                  </label>
                  <p className="text-xs text-wesup-ink-sub">
                    Pilih hari dalam seminggu untuk batch tayang (opsional jika interval harian).
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => {
                      const selected = draft.daysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          disabled={submitting}
                          className={`inline-flex items-center gap-1  px-3 py-1.5 text-xs font-semibold transition ${
                            selected
                              ? "border border-wesup-red bg-wesup-paper-sub text-wesup-ink"
                              : "border border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub hover:border-wesup-ink/20 hover:bg-wesup-paper-sub"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          aria-pressed={selected}
                        >
                          <span className="hidden sm:inline">{DAY_LABELS[day]}</span>
                          <span className="sm:hidden">{DAY_SHORT_LABELS[day]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.daysOfWeek && (
                    <p className="mt-1 text-xs text-wesup-red">{errors.daysOfWeek}</p>
                  )}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
              <span className="mt-1 shrink-0">
                <Info size={20} className="text-wesup-red" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-wesup-ink">Status Jadwal</p>
                <p className="text-xs text-wesup-ink-sub">
                  Aktif: batch akan di-generate otomatis. Nonaktif: jadwal ditunda.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("isActive", true)}
                    disabled={submitting}
                    className={` px-3 py-1.5 text-xs font-semibold transition ${
                      draft.isActive
                        ? "border border-wesup-ink/20 bg-wesup-paper-sub text-wesup-ink"
                        : "border border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub hover:bg-wesup-paper"
                    }`}
                  >
                    Aktif
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("isActive", false)}
                    disabled={submitting}
                    className={` px-3 py-1.5 text-xs font-semibold transition ${
                      !draft.isActive
                        ? "border border-wesup-ink/10 400 bg-wesup-paper-sub text-wesup-ink"
                        : "border border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub hover:bg-wesup-paper"
                    }`}
                  >
                    Nonaktif
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2  bg-wesup-paper-sub p-4 text-xs text-wesup-ink-sub">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Cara kerja:</p>
                <ul className="mt-1 space-y-0.5">
                  <li>&bull; Timestamp absolut batch dihitung otomatis dari interval yang diatur.</li>
                  <li>&bull; Anda akan menerima notifikasi H-1 sebelum batch tayang.</li>
                  <li>&bull; Batch baru hanya tayang setelah Anda mengkonfirmasi review.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Template Batch */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-wesup-ink outline-none"
            >
              Template Batch
            </h2>
            <p className="text-sm text-wesup-ink-sub">
              Isi detail produk yang akan digunakan sebagai template untuk setiap batch yang di-generate.
            </p>

            {/* Product Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
                <span className="mt-1 shrink-0">
                  <Package size={20} className="text-wesup-red" />
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <label htmlFor="tpl-title" className="text-sm font-semibold text-wesup-ink">
                      Nama Produk <span className="text-wesup-red">*</span>
                    </label>
                    {errors.templateTitle && (
                      <p className="mt-0.5 text-xs text-wesup-red">{errors.templateTitle}</p>
                    )}
                    <input
                      id="tpl-title"
                      type="text"
                      required
                      value={draft.templateTitle}
                      onChange={(e) => updateField("templateTitle", e.target.value)}
                      disabled={submitting}
                      placeholder="Contoh: Beras Rojolele 5 kg"
                      className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:bg-wesup-paper"
                    />
                  </div>

                  <div>
                    <label htmlFor="tpl-category" className="text-sm font-semibold text-wesup-ink">
                      Kategori <span className="text-wesup-red">*</span>
                    </label>
                    {errors.templateCategory && (
                      <p className="mt-0.5 text-xs text-wesup-red">{errors.templateCategory}</p>
                    )}
                    <select
                      id="tpl-category"
                      required
                      value={draft.templateCategory}
                      onChange={(e) => updateField("templateCategory", e.target.value)}
                      disabled={submitting}
                      className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:bg-wesup-paper"
                    >
                      <option value="">Pilih kategori...</option>
                      <option value="Makanan Siap Saji">Makanan Siap Saji</option>
                      <option value="Sayur & Buah">Sayur &amp; Buah</option>
                      <option value="Daging & Ikan">Daging &amp; Ikan</option>
                      <option value="Kerajinan">Kerajinan</option>
                      <option value="Jasa">Jasa</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tpl-desc" className="text-sm font-semibold text-wesup-ink">
                      Deskripsi <span className="text-wesup-red">*</span>
                    </label>
                    {errors.templateDescription && (
                      <p className="mt-0.5 text-xs text-wesup-red">{errors.templateDescription}</p>
                    )}
                    <textarea
                      id="tpl-desc"
                      required
                      rows={3}
                      value={draft.templateDescription}
                      onChange={(e) => updateField("templateDescription", e.target.value)}
                      disabled={submitting}
                      placeholder="Deskripsi singkat produk..."
                      className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:bg-wesup-paper"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Pricing */}
            <div id="tpl-tiers" className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
              <span className="mt-1 shrink-0">
                <TrendingDown size={20} className="text-wesup-red" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-wesup-ink">
                      Skema Harga Tier <span className="text-wesup-red">*</span>
                    </label>
                    <p className="text-xs text-wesup-ink-sub">
                      Harga tier besar harus lebih murah dari tier kecil.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTier}
                    disabled={submitting}
                    className="inline-flex items-center gap-1  border border-wesup-ink/20 bg-wesup-paper-sub px-3 py-1.5 text-xs font-semibold text-wesup-ink transition hover:bg-wesup-paper-sub"
                  >
                    <Plus size={14} />
                    Tambah Tier
                  </button>
                </div>

                {(errors.templateTiers || errors.templateTierInversion || errors.templateTierOverlap) && (
                  <div className="mt-2  border border-wesup-ink/20 bg-wesup-paper-sub p-2">
                    <p className="text-xs text-wesup-ink">
                      {errors.templateTiers || errors.templateTierInversion || errors.templateTierOverlap}
                    </p>
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  {draft.templateTiers.map((tier, index) => (
                    <div
                      key={tier.tierNumber}
                      className="flex flex-col gap-2  border border-wesup-ink/10 bg-wesup-paper p-3 sm:flex-row sm:items-center"
                    >
                      <span className="text-xs font-bold text-wesup-ink sm:w-16">
                        Tier {tier.tierNumber}
                      </span>
                      <div className="flex flex-1 gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-wesup-ink-sub">Min Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={tier.minimumQuantity}
                            onChange={(e) => updateTier(index, "minimumQuantity", Number(e.target.value) || 1)}
                            disabled={submitting}
                            className="w-full  border border-wesup-ink/15 px-2 py-1.5 text-xs text-wesup-ink outline-none focus:border-wesup-red disabled:bg-wesup-paper"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-wesup-ink-sub">Max Qty</label>
                          <input
                            type="number"
                            min={tier.minimumQuantity}
                            value={tier.maximumQuantity ?? ""}
                            onChange={(e) => updateTier(index, "maximumQuantity", e.target.value ? Number(e.target.value) : null)}
                            disabled={submitting || index === draft.templateTiers.length - 1}
                            placeholder={index === draft.templateTiers.length - 1 ? "∞" : ""}
                            className="w-full  border border-wesup-ink/15 px-2 py-1.5 text-xs text-wesup-ink outline-none focus:border-wesup-red disabled:bg-wesup-paper disabled:text-wesup-ink-sub"
                          />
                        </div>
                        <div className="w-28">
                          <label className="text-[10px] text-wesup-ink-sub">Harga/Unit</label>
                          <input
                            type="number"
                            min={0}
                            value={tier.pricePerUnit || ""}
                            onChange={(e) => updateTier(index, "pricePerUnit", Number(e.target.value) || 0)}
                            disabled={submitting}
                            placeholder="Rp"
                            className="w-full  border border-wesup-ink/15 px-2 py-1.5 text-xs text-wesup-ink outline-none focus:border-wesup-red disabled:bg-wesup-paper"
                          />
                        </div>
                      </div>
                      {draft.templateTiers.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeTier(index)}
                          disabled={submitting}
                          className="self-end  p-1 text-wesup-red/70 transition hover:bg-wesup-paper hover:text-wesup-red sm:self-center"
                          aria-label={`Hapus Tier ${tier.tierNumber}`}
                        >
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pickup Location */}
            <div className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 ">
              <span className="mt-1 shrink-0">
                <MapPin size={20} className="text-wesup-ink-sub" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label htmlFor="tpl-pickup-name" className="text-sm font-semibold text-wesup-ink">
                    Nama Lokasi <span className="text-wesup-red">*</span>
                  </label>
                  {errors.templatePickupName && (
                    <p className="mt-0.5 text-xs text-wesup-red">{errors.templatePickupName}</p>
                  )}
                  <input
                    id="tpl-pickup-name"
                    type="text"
                    required
                    value={draft.templatePickupName}
                    onChange={(e) => updateField("templatePickupName", e.target.value)}
                    disabled={submitting}
                    placeholder="Contoh: Gudang Wesup Bandung"
                    className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:bg-wesup-paper"
                  />
                </div>

                <div>
                  <label htmlFor="tpl-pickup-address" className="text-sm font-semibold text-wesup-ink">
                    Alamat <span className="text-wesup-red">*</span>
                  </label>
                  {errors.templatePickupAddress && (
                    <p className="mt-0.5 text-xs text-wesup-red">{errors.templatePickupAddress}</p>
                  )}
                  <input
                    id="tpl-pickup-address"
                    type="text"
                    required
                    value={draft.templatePickupAddress}
                    onChange={(e) => updateField("templatePickupAddress", e.target.value)}
                    disabled={submitting}
                    placeholder="Alamat lengkap lokasi pengambilan..."
                    className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:bg-wesup-paper"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-wesup-ink">
                    Koordinat Pin Peta <span className="text-wesup-red">*</span>
                  </label>
                  {errors.templateCoordinate && (
                    <p className="mt-0.5 text-xs text-wesup-red">{errors.templateCoordinate}</p>
                  )}
                  <div id="tpl-coordinate" className="relative mt-1 flex h-32 items-center justify-center overflow-hidden  border border-wesup-ink/15 bg-wesup-paper-sub">
                    <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwdjIwSDIwVjBIMHptMTkgMTlIMVYxSDE5djE4eiIgZmlsbD0iI2QxZDVkYiI+PC9wYXRoPgo8L3N2Zz4=')]" />
                    <button
                      type="button"
                      onClick={() => {
                        updateField("templatePickupLatitude", -6.921857);
                        updateField("templatePickupLongitude", 107.609729);
                        setErrors((e) => ({ ...e, templateCoordinate: undefined }));
                      }}
                      disabled={submitting}
                      className="relative  bg-wesup-paper px-3 py-1.5 text-xs font-bold text-wesup-red  transition hover:bg-wesup-paper-sub disabled:opacity-50"
                    >
                      {draft.templatePickupLatitude !== null
                        ? `Koordinat: ${draft.templatePickupLatitude.toFixed(5)}, ${draft.templatePickupLongitude?.toFixed(5)}`
                        : "Klik untuk menandai lokasi (demo)"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Tinjauan */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-wesup-ink outline-none"
            >
              Tinjauan Jadwal
            </h2>
            <p className="text-sm text-wesup-ink-sub">
              Pastikan semua informasi sudah benar sebelum menyimpan jadwal.
            </p>

            {/* Status */}
            <div className=" border border-wesup-ink/20 bg-wesup-paper-sub p-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-wesup-red" />
                <p className="text-sm font-medium text-wesup-ink-sub">
                  Batch akan di-generate otomatis sesuai jadwal. Anda akan menerima
                  notifikasi H-1 untuk review sebelum tayang.
                </p>
              </div>
            </div>

            {/* Schedule Summary */}
            <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
                <Calendar size={16} className="text-wesup-red" />
                Jadwal
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-wesup-ink-sub">Nama Jadwal</dt>
                  <dd className="font-semibold text-wesup-ink">{draft.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-wesup-ink-sub">Interval</dt>
                  <dd className="font-semibold text-wesup-ink">
                    Setiap {draft.intervalDays} hari
                  </dd>
                </div>
                {draft.daysOfWeek.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-wesup-ink-sub">Hari Tayang</dt>
                    <dd className="font-semibold text-wesup-ink">
                      {draft.daysOfWeek
                        .sort((a, b) => a - b)
                        .map((d) => DAY_LABELS[d as DayOfWeek])
                        .join(", ")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-wesup-ink-sub">Status</dt>
                  <dd>
                    <span
                      className={
                        draft.isActive
                          ? "inline-flex items-center gap-1  bg-wesup-paper-sub px-2 py-0.5 text-xs font-semibold text-wesup-ink"
                          : "inline-flex items-center gap-1  bg-wesup-paper-sub px-2 py-0.5 text-xs font-semibold text-wesup-ink-sub"
                      }
                    >
                      {draft.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            {/* Product Summary */}
            <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
                <Package size={16} className="text-wesup-red" />
                Template Produk
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-wesup-ink-sub">Nama Produk</dt>
                  <dd className="font-semibold text-wesup-ink">{draft.templateTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-wesup-ink-sub">Kategori</dt>
                  <dd>
                    <span className=" bg-wesup-paper-sub px-2 py-0.5 text-xs font-medium text-wesup-red">
                      {draft.templateCategory}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-wesup-ink-sub">Deskripsi</dt>
                  <dd className="max-w-xs text-right text-wesup-ink">
                    {draft.templateDescription}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Tier Summary */}
            <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
                <TrendingDown size={16} className="text-wesup-red" />
                Skema Harga Tier
              </h3>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="text-xl font-bold text-wesup-ink">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(lowestPrice)}
                </span>
                {lowestPrice < highestPrice && (
                  <span className="text-sm text-wesup-ink-sub line-through">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(highestPrice)}
                  </span>
                )}
              </div>
              <ul className="space-y-1 text-sm">
                {draft.templateTiers.map((tier) => (
                  <li key={tier.tierNumber} className="flex justify-between">
                    <span className="text-wesup-ink-sub">
                      Tier {tier.tierNumber}: {tier.minimumQuantity}–{tier.maximumQuantity ?? "+"} pcs
                    </span>
                    <strong className="text-wesup-ink">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(tier.pricePerUnit)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>

            {/* Pickup Summary */}
            <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-wesup-ink">
                <MapPin size={16} className="text-wesup-ink-sub" />
                Lokasi Pengambilan
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-wesup-ink">{draft.templatePickupName}</p>
                <p className="text-wesup-ink-sub">{draft.templatePickupAddress}</p>
                {draft.templatePickupLatitude !== null && draft.templatePickupLongitude !== null && (
                  <p className="font-mono text-xs text-wesup-ink-sub">
                    Koordinat: {draft.templatePickupLatitude.toFixed(5)},{" "}
                    {draft.templatePickupLongitude.toFixed(5)}
                  </p>
                )}
              </div>
            </section>

            {/* Preview */}
            <RecurringBatchPreviewCard preview={preview} />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-wesup-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2  border border-wesup-ink/15 px-5 py-3 text-sm font-semibold text-wesup-ink transition hover:border-wesup-red hover:bg-wesup-paper-sub hover:text-wesup-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2  border border-wesup-ink/15 px-5 py-3 text-sm font-semibold text-wesup-ink transition hover:border-wesup-red hover:bg-wesup-paper-sub hover:text-wesup-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Simpan Draft
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2  bg-wesup-ink px-6 py-3 text-sm font-semibold text-wesup-paper  transition hover:bg-wesup-red focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-56"
            >
              {formState.submitPhase === "publishing" ? (
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : formState.submitPhase === "saved" ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : currentStep === 3 ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              )}
              {formState.submitPhase === "publishing"
                ? "Menyimpan..."
                : formState.submitPhase === "saved"
                  ? "Berhasil Disimpan!"
                  : currentStep === 3
                    ? "Simpan Jadwal"
                    : "Lanjut"}
            </button>
          </div>
        </div>

        {currentStep === 3 && (
          <p className="mt-4 text-center text-xs leading-5 text-wesup-ink-sub">
            Dengan menyimpan, Anda menyetujui jadwal ini akan menghasilkan batch
            otomatis sesuai interval yang diatur.
          </p>
        )}
      </form>

      {/* Success state */}
      {formState.submitPhase === "saved" && (
        <div className="mt-6  border border-wesup-ink/20 bg-wesup-paper-sub p-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-wesup-ink-sub" />
          <h3 className="mt-3 text-lg font-bold text-wesup-ink-sub">
            Jadwal berhasil disimpan!
          </h3>
          <p className="mt-1 text-sm text-wesup-ink">
            Batch akan di-generate otomatis sesuai jadwal yang diatur.
          </p>
          <button
            type="button"
            onClick={() => router.push("/supplier/recurring")}
            className="mt-4 inline-flex items-center gap-2  bg-wesup-red px-5 py-2.5 text-sm font-semibold text-wesup-paper hover:bg-wesup-paper"
          >
            Lihat Semua Jadwal
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
    field === "templateCoordinate"
      ? "tpl-coordinate"
      : field === "templateTierInversion" || field === "templateTierOverlap"
        ? "tpl-tiers"
        : field === "daysOfWeek"
          ? "recurring-name"
          : field.startsWith("templateTiers.")
            ? "tpl-tiers"
            : field === "intervalDays"
              ? "recurring-interval"
              : field;
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target instanceof HTMLElement && target.matches("input, textarea, select")) target.focus();
}
