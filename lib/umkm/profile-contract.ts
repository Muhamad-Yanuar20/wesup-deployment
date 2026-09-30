import {
  BANDUNG_SERVICE_RADIUS_KM,
  isWithinBandungServiceRadius,
} from "@/lib/geo/service-center";

export interface UmkmProfilePayload {
  businessName: string;
  address: string;
  latitude: number;
  longitude: number;
}

export type UmkmProfileValidationResult =
  | { ok: true; value: UmkmProfilePayload }
  | { ok: false; fieldErrors: Record<string, string> };

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

export function parseUmkmProfilePayload(
  input: unknown,
): UmkmProfileValidationResult {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const businessName = asText(source.businessName ?? source.business_name);
  const address = asText(source.address);
  const latitude = asNumber(source.latitude);
  const longitude = asNumber(source.longitude);
  const fieldErrors: Record<string, string> = {};

  if (!businessName) fieldErrors.businessName = "Nama usaha wajib diisi.";
  if (!address) fieldErrors.address = "Alamat usaha wajib diisi.";

  if (!isWithinBandungServiceRadius({ lat: latitude, lng: longitude })) {
    fieldErrors.coordinate = `Pin lokasi harus berada maksimal ${BANDUNG_SERVICE_RADIUS_KM} km dari pusat layanan Bandung.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: { businessName, address, latitude, longitude },
  };
}
