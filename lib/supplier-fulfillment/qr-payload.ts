import { isUuid } from "@/lib/admin/validation";
export interface PickupQrPayload { type: "wesup_pickup"; version: 1; registrationId: string; token: string; }
export function encodePickupQr(registrationId: string, token: string): string {
  return JSON.stringify({ type: "wesup_pickup", version: 1, registrationId, token } satisfies PickupQrPayload);
}
export function decodePickupQr(raw: string): PickupQrPayload | { token: string; registrationId: null } {
  const text = raw.trim();
  if (!text || text.length > 1024) throw new Error("QR pengambilan tidak valid.");
  if (/^[a-f0-9]{36}$/i.test(text)) return { token: text, registrationId: null };
  try {
    const value = JSON.parse(text);
    if (value?.type === "wesup_pickup" && value.version === 1 && isUuid(value.registrationId) && typeof value.token === "string" && /^[a-f0-9]{36}$/i.test(value.token)) return value as PickupQrPayload;
  } catch { /* Invalid QR, never navigate to or execute its contents. */ }
  throw new Error("QR ini bukan kode pengambilan Wesup yang valid.");
}
