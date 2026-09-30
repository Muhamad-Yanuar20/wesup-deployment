import { isWithinBandungServiceRadius } from "@/lib/geo/service-center";

export interface UmkmRegistrationFields {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  latitude: number;
  longitude: number;
}

export type UmkmRegistrationFieldErrors = Partial<
  Record<"full_name" | "phone" | "email" | "password" | "latitude" | "longitude" | "location", string>
>;

export const UMKM_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UMKM_PHONE_RE = /^\+?[0-9][0-9\s-]{7,19}$/;

export function normalizeUmkmEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseUmkmRegistrationPayload(input: unknown):
  | { ok: true; fields: UmkmRegistrationFields }
  | { ok: false; fieldErrors: UmkmRegistrationFieldErrors } {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fullName = typeof source.full_name === "string" ? source.full_name.trim() : "";
  const email = typeof source.email === "string" ? normalizeUmkmEmail(source.email) : "";
  const phone = typeof source.phone === "string" ? source.phone.trim() : "";
  const password = typeof source.password === "string" ? source.password : "";
  const latitude = typeof source.latitude === "number" ? source.latitude : Number(source.latitude);
  const longitude = typeof source.longitude === "number" ? source.longitude : Number(source.longitude);
  const fieldErrors: UmkmRegistrationFieldErrors = {};

  if (fullName.length < 2) fieldErrors.full_name = "Nama lengkap wajib diisi.";
  if (!UMKM_PHONE_RE.test(phone)) fieldErrors.phone = "Masukkan nomor WhatsApp yang valid.";
  if (!UMKM_EMAIL_RE.test(email)) fieldErrors.email = "Masukkan alamat email yang valid.";
  if (password.length < 8) fieldErrors.password = "Password minimal 8 karakter.";
  if (!Number.isFinite(latitude)) fieldErrors.latitude = "Pilih titik lokasi usaha.";
  if (!Number.isFinite(longitude)) fieldErrors.longitude = "Pilih titik lokasi usaha.";
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && !isWithinBandungServiceRadius({ lat: latitude, lng: longitude })) {
    fieldErrors.location = "Titik lokasi harus berada maksimal 50 km dari pusat layanan Bandung.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, fields: { fullName, email, phone, password, latitude, longitude } };
}

export type UmkmRegistrationSuccessResponse = {
  ok: true;
  requiresEmailConfirmation: boolean;
};
