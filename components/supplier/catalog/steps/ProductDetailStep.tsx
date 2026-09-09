"use client";

import { ImageIcon } from "lucide-react";
import { BATCH_CATEGORIES } from "@/lib/catalog/categories";
import type { CatalogDraft, FieldErrors } from "@/lib/supplier-catalog/types";

interface ProductDetailStepProps {
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFieldChange: (field: "title" | "category" | "description", value: string) => void;
  onPhotoChange: (file: File | null) => void;
}

export default function ProductDetailStep({
  draft,
  errors,
  disabled,
  headingRef,
  onFieldChange,
  onPhotoChange,
}: ProductDetailStepProps) {
  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-slate-900 outline-none"
      >
        Detail Produk
      </h2>
      <p className="text-sm text-slate-500">
        Isi informasi dasar produk yang ingin Anda tawarkan.
      </p>

      {/* Nama Produk */}
      <div>
        <label
          htmlFor="catalog-title"
          className="block text-sm font-semibold text-slate-800"
        >
          Nama Produk <span className="text-red-500">*</span>
        </label>
        <input
          id="catalog-title"
          type="text"
          required
          value={draft.title}
          onChange={(e) => onFieldChange("title", e.target.value)}
          disabled={disabled}
          placeholder="Contoh: Beras Rojolele 5 kg"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.title && (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      {/* Kategori */}
      <div>
        <label
          htmlFor="catalog-category"
          className="block text-sm font-semibold text-slate-800"
        >
          Kategori <span className="text-red-500">*</span>
        </label>
        <select
          id="catalog-category"
          required
          value={draft.category}
          onChange={(e) => onFieldChange("category", e.target.value)}
          disabled={disabled}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="" disabled>
            Pilih kategori...
          </option>
          {BATCH_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.category}
          </p>
        )}
      </div>

      {/* Deskripsi */}
      <div>
        <label
          htmlFor="catalog-description"
          className="block text-sm font-semibold text-slate-800"
        >
          Deskripsi <span className="text-red-500">*</span>
        </label>
        <textarea
          id="catalog-description"
          required
          value={draft.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="Jelaskan produk Anda, kualitas, keunggulan, dll."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.description && (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.description}
          </p>
        )}
      </div>

      {/* Foto Produk */}
      <div>
        <label className="block text-sm font-semibold text-slate-800">
          Foto Produk <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Format .webp, maksimal 10MB. Akan dikompresi otomatis.
        </p>
        <div className="mt-2">
          {draft.productPhoto ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                <img
                  src={URL.createObjectURL(draft.productPhoto)}
                  alt="Preview foto produk"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {draft.productPhoto.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(draft.productPhoto.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPhotoChange(null)}
                disabled={disabled}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hapus
              </button>
            </div>
          ) : (
            <label
              id="product-photo-label"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition hover:border-blue-300 hover:bg-blue-50/50"
            >
              <ImageIcon size={24} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                Klik untuk unggah foto produk
              </span>
              <span className="text-xs text-slate-400">
                .webp, maks 10MB
              </span>
              <input
                id="product-photo"
                type="file"
                accept=".webp,image/webp"
                required
                disabled={disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  onPhotoChange(file);
                }}
                className="sr-only"
                aria-labelledby="product-photo-label"
              />
            </label>
          )}
        </div>
        {errors.productPhoto && (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.productPhoto}
          </p>
        )}
      </div>
    </div>
  );
}
