"use client";

import BusinessLocationPickerClient from "@/components/maps/BusinessLocationPickerClient";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";

export function SupplierLocationMapClient({ value, onChange, error, disabled }: { value: MapCoordinate | null; onChange: (coordinate: MapCoordinate) => void; error?: string; disabled?: boolean }) {
  return <BusinessLocationPickerClient value={value} onChange={onChange} error={error} disabled={disabled} label="Lokasi usaha" />;
}