"use client";

import { ImageIcon } from "lucide-react";
import { BATCH_CATEGORIES } from "@/lib/catalog/categories";
import BusinessPhotoField from "@/components/supplier/BusinessPhotoField";
import type { CatalogDraft, FieldErrors } from "@/lib/supplier-catalog/types";

interface ProductDetailStepProps {
  simplified?: boolean;
  commercialLocked?: boolean;
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFieldChange: (field: "title" | "category" | "description", value: string) => void;
  onTargetQuantityChange: (value: number) => void;
  onEarlyPaymentMinimumChange?: (value: number) => void;
  onCapacityQuantityChange: (value: number) => void;
  onUnitChange: (value: CatalogDraft["unit"]) => void;
  onPhotoChange: (file: File | null) => void;
}

export default function ProductDetailStep({
  draft,
  errors,
  disabled,
  headingRef,
  onFieldChange,
  onTargetQuantityChange,
  onCapacityQuantityChange,
  onEarlyPaymentMinimumChange,
  onUnitChange,
  onPhotoChange,
  simplified = false,
  commercialLocked = false,
}: ProductDetailStepProps) {
  return (
    <div className="space-y-6">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">
        Detail Produk
      </h2>
      <p className="text-sm text-slate-500">Isi informasi dasar produk yang ingin Anda tawarkan.</p>

      <div>
        <label htmlFor="catalog-title" className="block text-sm font-semibold text-slate-800">
          Nama Produk <span className="text-red-500">*</span>
        </label>
        <input
          id="catalog-title" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "catalog-title-error" : undefined}
          type="text"
          required
          value={draft.title}
          onChange={(e) => onFieldChange("title", e.target.value)}
          disabled={disabled}
          placeholder="Contoh: Beras Rojolele 5 kg"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.title && <p id="catalog-title-error" className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.title}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="catalog-capacity-quantity" className="block text-sm font-semibold text-slate-800">
            Kapasitas maksimum ({draft.unit ?? "pcs"}) <span className="text-red-500">*</span>
          </label>
          <input
            id="catalog-capacity-quantity" aria-invalid={Boolean(errors.capacityQuantity)}
            aria-describedby={errors.capacityQuantity ? "catalog-capacity-hint catalog-capacityQuantity-error" : "catalog-capacity-hint"}
            type="number"
            min={simplified ? 1 : draft.targetQuantity || 1}
            step={1}
            required
            value={draft.capacityQuantity ?? draft.targetQuantity ?? ""}
            onChange={(e) => onCapacityQuantityChange(Number(e.target.value) || 0)}
            disabled={disabled || commercialLocked}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <p id="catalog-capacity-hint" className="mt-1.5 text-xs text-slate-500">{simplified ? "Penerimaan berhenti saat penuh. Jadwal pengambilan tetap." : "Batch otomatis ditutup ketika kuota ini terpenuhi."}</p>
          {errors.capacityQuantity && <p id="catalog-capacityQuantity-error" className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.capacityQuantity}</p>}
        </div>
        <div>
          <label htmlFor="catalog-unit" className="block text-sm font-semibold text-slate-800">Satuan produk <span className="text-red-500">*</span></label>
          <select id="catalog-unit" aria-invalid={Boolean(errors.unit)} aria-describedby={errors.unit ? "catalog-unit-error" : undefined} value={draft.unit ?? "pcs"} onChange={(e) => onUnitChange(e.target.value as CatalogDraft["unit"])} disabled={disabled || commercialLocked} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100">
            {(["kg", "gram", "liter", "ml", "pcs", "pack", "karung", "ikat", "sisir"] as const).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          {errors.unit && <p id="catalog-unit-error" className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.unit}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="catalog-category" className="block text-sm font-semibold text-slate-800">
          Kategori <span className="text-red-500">*</span>
        </label>
        <select
          id="catalog-category" aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "catalog-category-error" : undefined}
          required
          value={draft.category}
          onChange={(e) => onFieldChange("category", e.target.value)}
          disabled={disabled}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="" disabled>Pilih kategori...</option>
          {BATCH_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {errors.category && <p id="catalog-category-error" className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.category}</p>}
      </div>

      {onEarlyPaymentMinimumChange && <div>
        <label htmlFor="catalog-early-payment-minimum" className="block text-sm font-semibold text-slate-800">Target minimum untuk membuka pembayaran lebih awal ({draft.unit ?? "pcs"}) <span className="text-red-500">*</span></label>
        <input id="catalog-early-payment-minimum" type="number" min={1} max={draft.capacityQuantity} step={1} value={draft.earlyPaymentMinimumQuantity || ""} disabled={disabled || commercialLocked} onChange={e => onEarlyPaymentMinimumChange(Number(e.target.value))} aria-invalid={Boolean(errors.earlyPaymentMinimumQuantity)} aria-describedby={`catalog-early-payment-hint${errors.earlyPaymentMinimumQuantity ? " catalog-early-payment-error" : ""}`} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <p id="catalog-early-payment-hint" className="mt-1.5 text-sm text-slate-600">Terpisah dari kapasitas dan ambang diskon. Setelah target tercapai, supplier dapat menutup pendaftaran dan membuka pembayaran 24 jam. Jadwal pengambilan tetap.</p>
        {errors.earlyPaymentMinimumQuantity && <p id="catalog-early-payment-error" role="alert" className="mt-1 text-sm text-red-700">{errors.earlyPaymentMinimumQuantity}</p>}
      </div>}
      {!simplified && <div>
        <label htmlFor="catalog-target-quantity" className="block text-sm font-semibold text-slate-800">
          Target kelompok (pcs) <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-slate-500">Jumlah minimum volume yang ingin dicapai sebelum batch diproses.</p>
        <input
          id="catalog-target-quantity" aria-invalid={Boolean(errors.targetQuantity)} aria-describedby={errors.targetQuantity ? "catalog-targetQuantity-error" : undefined}
          type="number"
          min={1}
          step={1}
          required
          value={draft.targetQuantity || ""}
          onChange={(e) => onTargetQuantityChange(Number(e.target.value) || 0)}
          disabled={disabled}
          placeholder="Contoh: 50"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.targetQuantity && <p id="catalog-targetQuantity-error" className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.targetQuantity}</p>}
      </div>}
      <div>
        <label htmlFor="catalog-description" className="block text-sm font-semibold text-slate-800">
          Deskripsi <span className="text-red-500">*</span>
        </label>
        <textarea
          id="catalog-description" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "catalog-description-error" : undefined}
          required
          value={draft.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="Jelaskan produk Anda, kualitas, keunggulan, dll."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.description && <p id="catalog-description-error" className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.description}</p>}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <ImageIcon size={17} className="text-blue-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Foto Produk <span className="text-red-500">*</span></p>
            <p className="text-xs text-slate-500">JPEG, PNG, atau WebP maksimal 10 MB. Akan dikompresi menjadi WebP.</p>
          </div>
        </div>
        <BusinessPhotoField
          value={draft.productPhoto}
          onChange={onPhotoChange}
          error={errors.productPhoto}
          disabled={disabled}
          variant="product"
          existingUrl={draft.productPhotoUrl}
        />
      </div>
    </div>
  );
}
