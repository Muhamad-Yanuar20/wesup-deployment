import { BANDUNG_SERVICE_CENTER } from "@/lib/geo/service-center";

export const BATCH_CATEGORIES = [
  "Sayur & Buah",
  "Daging & Ikan",
  "Makanan Siap Saji",
  "Kerajinan",
  "Jasa",
] as const;

export type BatchCategory = (typeof BATCH_CATEGORIES)[number];

/** @deprecated Use BANDUNG_SERVICE_CENTER for new code. */
export const BANDUNG_CENTER = BANDUNG_SERVICE_CENTER;

export const SEARCH_DEFAULT_RADIUS_KM = 10;
export const SEARCH_MIN_RADIUS_KM = 1;
export const SEARCH_MAX_RADIUS_KM = 50;
export const SEARCH_DEFAULT_LIMIT = 12;
export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_MAX_QUERY_LENGTH = 120;

export function isBatchCategory(value: string): value is BatchCategory {
  return (BATCH_CATEGORIES as readonly string[]).includes(value);
}
