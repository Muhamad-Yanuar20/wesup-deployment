"use client";

import type { RefObject } from "react";
import { Camera } from "lucide-react";
import type { FieldErrors } from "@/lib/supplier-registration/contracts";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import BusinessPhotoField from "@/components/supplier/BusinessPhotoField";
import { SupplierLocationMapClient } from "@/components/supplier/SupplierLocationMapClient";

export interface LocationPhotoStepProps {
  coordinate: MapCoordinate | null;
  photo: File | null;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onCoordinateChange: (coordinate: MapCoordinate) => void;
  onPhotoChange: (photo: File | null) => void;
}

export default function LocationPhotoStep({
  coordinate,
  photo,
  errors,
  disabled,
  headingRef,
  onCoordinateChange,
  onPhotoChange,
}: LocationPhotoStepProps) {
  return (
    <section aria-labelledby="supplier-registration-location-title">
      <div className="flex flex-col gap-3 border-b border-wesup-ink/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 ref={headingRef} id="supplier-registration-location-title" tabIndex={-1} className="text-2xl tracking-tight text-wesup-ink outline-none sm:text-3xl font-landing-display font-normal uppercase tracking-[0.04em]">
            Tentukan lokasi usaha
          </h2>
          <p className="mt-2 text-sm leading-6 text-wesup-ink-sub">Pilih titik yang tepat dan unggah foto fisik tempat usaha.</p>
        </div>
        <span className="w-fit border border-wesup-ink/10 bg-wesup-paper px-3 py-1.5 text-xs font-semibold text-wesup-ink-sub">Langkah 3 dari 4</span>
      </div>

      <div id="supplier-location" className="mt-8">
        <SupplierLocationMapClient
          value={coordinate}
          onChange={onCoordinateChange}
          error={errors.location}
          disabled={disabled}
        />
      </div>

      <div id="business-photo" className="mt-8 border-t border-wesup-ink/10 pt-8">
        <label className="flex items-center gap-2 text-wesup-ink-sub font-mono text-[0.6875rem] uppercase tracking-[0.18em]">
          <Camera className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />
          Foto Fisik Tempat Usaha
        </label>
        <p className="mt-1 text-sm text-wesup-ink-sub">Foto akan diproses menjadi WebP otomatis bila diperlukan.</p>
        <div className="mt-4">
          <BusinessPhotoField
            value={photo}
            onChange={onPhotoChange}
            error={errors.businessPhoto}
            disabled={disabled}
          />
        </div>
      </div>
    </section>
  );
}
