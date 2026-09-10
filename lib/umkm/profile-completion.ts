import { isWithinBandungServiceRadius } from "@/lib/geo/service-center";

export interface UmkmProfileCompletionInput {
  business_name?: unknown;
  businessName?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

/** A location-only row is intentionally incomplete until business details are supplied. */
export function isCompleteUmkmProfile(profile: UmkmProfileCompletionInput | null | undefined): boolean {
  if (!profile) return false;
  const businessName = profile.business_name ?? profile.businessName;
  const address = profile.address;
  if (typeof businessName !== "string" || businessName.trim() === "") return false;
  if (typeof address !== "string" || address.trim() === "") return false;
  return isWithinBandungServiceRadius({ lat: asNumber(profile.latitude), lng: asNumber(profile.longitude) });
}

export function hasValidUmkmLocation(profile: UmkmProfileCompletionInput | null | undefined): boolean {
  if (!profile) return false;
  return isWithinBandungServiceRadius({ lat: asNumber(profile.latitude), lng: asNumber(profile.longitude) });
}
