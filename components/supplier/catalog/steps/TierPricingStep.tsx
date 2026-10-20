"use client";

import { AlertCircle, Lock, MinusCircle, PlusCircle, TrendingDown } from "lucide-react";
import type { CatalogDraft, CatalogTierDraft, FieldErrors } from "@/lib/supplier-catalog/types";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

interface TierPricingStepProps {
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  locked?: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onTiersChange: (tiers: CatalogTierDraft[]) => void;
}

export default function TierPricingStep({
  draft,
  errors,
  disabled,
  locked = false,
  headingRef,
  onTiersChange,
}: TierPricingStepProps) {
  const tiers = draft.tiers;
  const blocked = disabled || locked;

  function updateTier(index: number, field: keyof CatalogTierDraft, value: string | number | null) {
    const numeric = (): number =>
      value === "" || value === null ? 0 : Number(value);
    const maxValue = (): number | null =>
      value === "" || value === null ? null : Number(value);

    const updated: CatalogTierDraft[] = tiers.map((tier, i) => {
      if (i !== index) return tier;
      return {
        ...tier,
        minimumQuantity: field === "minimumQuantity" ? numeric() : tier.minimumQuantity,
        maximumQuantity: field === "maximumQuantity" ? maxValue() : tier.maximumQuantity,
        pricePerUnit: field === "pricePerUnit" ? numeric() : tier.pricePerUnit,
      };
    });
    onTiersChange(updated);
  }

  function addTier() {
    const lastTier = tiers.at(-1);
    const newMin = lastTier ? (lastTier.maximumQuantity ?? lastTier.minimumQuantity) + 1 : 1;
    onTiersChange([
      ...tiers,
      {
        tierNumber: tiers.length + 1,
        minimumQuantity: newMin,
        maximumQuantity: null,
        pricePerUnit: 0,
      },
    ]);
  }

  function removeTier(index: number) {
    if (tiers.length <= 2) return;
    const updated = tiers
      .filter((_, i) => i !== index)
      .map((tier, i) => ({ ...tier, tierNumber: i + 1 }));
    onTiersChange(updated);
  }

  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-wesup-ink outline-none"
      >
        Harga Tier
      </h2>
      <p className="text-sm text-wesup-ink-sub">
        Tentukan minimal 2 tingkatan harga berdasarkan volume pendaftar. Tier dengan kuantitas lebih besar harus lebih murah.
      </p>

      {/* Validation warnings */}
      {(errors.tierOverlap || errors.tierInversion) && (
        <div className=" border   p-4" role="alert">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0 " />
            <div className="text-sm ">
              {errors.tierOverlap && <p>{errors.tierOverlap}</p>}
              {errors.tierInversion && <p>{errors.tierInversion}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Location lock notice */}
      {locked && (
        <div className="flex items-start gap-3  border border-wesup-ink/20 bg-wesup-paper-sub p-4" role="alert">
          <Lock size={18} className="mt-0.5 shrink-0 text-wesup-ink-sub" />
          <div className="text-sm text-wesup-ink-sub">
            <p className="font-semibold">Skema harga terkunci</p>
            <p className="mt-1">
              Sudah ada peserta terdaftar pada penawaran ini, sehingga skema harga tier tidak dapat diubah. Buat penawaran baru jika ingin mengubah harga.
            </p>
          </div>
        </div>
      )}

      {/* Tier list */}
      <div className="space-y-4">
        {tiers.map((tier, index) => (
          <div
            key={tier.tierNumber}
            className=" border border-wesup-ink/15 bg-wesup-paper p-4 "
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center  bg-wesup-paper-sub text-xs font-bold text-wesup-ink">
                  {tier.tierNumber}
                </span>
                <span className="text-sm font-semibold ">
                  Tier {tier.tierNumber}
                  {index === 0 && (
                    <span className="ml-2 text-xs font-normal text-wesup-ink-sub">
                      (Harga Dasar/Tertinggi)
                    </span>
                  )}
                </span>
              </div>
              {tiers.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeTier(index)}
                  disabled={blocked}
                  className=" p-1 text-wesup-ink-sub transition hover:bg-wesup-paper hover:text-wesup-red disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Hapus Tier ${tier.tierNumber}`}
                >
                  <MinusCircle size={18} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Min Qty */}
              <div>
                <label className="block text-xs font-medium text-wesup-ink-sub">
                  Kuantitas Minimum
                </label>
                <input
                  type="number"
                  min={1}
                  value={tier.minimumQuantity || ""}
                  onChange={(e) => updateTier(index, "minimumQuantity", e.target.value)}
                  disabled={blocked || index === 0}
                  className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper"
                />
              </div>

              {/* Max Qty */}
              <div>
                <label className="block text-xs font-medium text-wesup-ink-sub">
                  Kuantitas Maksimum
                </label>
                <input
                  type="number"
                  min={tier.minimumQuantity}
                  value={tier.maximumQuantity ?? ""}
                  onChange={(e) => updateTier(index, "maximumQuantity", e.target.value === "" ? null : e.target.value)}
                  disabled={blocked || index === 0}
                  placeholder={index === 0 ? "Tanpa batas" : ""}
                  className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper placeholder:text-wesup-ink-sub"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-medium text-wesup-ink-sub">
                  Harga per Unit
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={tier.pricePerUnit || ""}
                  onChange={(e) => updateTier(index, "pricePerUnit", e.target.value)}
                  disabled={blocked}
                  placeholder="Rp"
                  className="mt-1 w-full  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper placeholder:text-wesup-ink-sub"
                />
                {tier.pricePerUnit > 0 && (
                  <p className="mt-1 text-xs text-wesup-ink-sub">
                    {money.format(tier.pricePerUnit)}/pcs
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add tier button */}
      <button
        type="button"
        onClick={addTier}
        disabled={blocked}
        className="flex w-full items-center justify-center gap-2  border-2 border-dashed border-wesup-ink/15 bg-wesup-paper py-3 text-sm font-medium text-wesup-ink-sub transition hover:border-wesup-red hover:bg-wesup-paper-sub hover:text-wesup-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusCircle size={18} />
        Tambah Tier
      </button>

      {/* Info */}
      <div className="flex items-start gap-2  bg-wesup-paper-sub p-4 text-xs text-wesup-ink">
        <TrendingDown size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Aturan Harga Tier:</p>
          <ul className="mt-1 space-y-0.5">
            <li>&bull; Harga tier dengan kuantitas lebih besar harus lebih murah.</li>
            <li>&bull; Rentang kuota antar tier tidak boleh overlap.</li>
            <li>&bull; Tier terakhir (kuantitas tidak terbatas) bertindak sebagai harga dasar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
