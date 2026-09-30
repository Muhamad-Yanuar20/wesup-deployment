import { BANDUNG_SERVICE_CENTER, isValidGeoCoordinate, type GeoCoordinate } from "@/lib/geo/service-center";

export type MapCoordinate = GeoCoordinate;

/** Compatibility export for the demo map; the source of truth is canonical. */
export const BANDUNG_CENTER: Readonly<MapCoordinate> = BANDUNG_SERVICE_CENTER;

export function isValidCoordinate(coordinate: MapCoordinate): boolean {
  return isValidGeoCoordinate(coordinate);
}

export function formatCoordinate(coordinate: MapCoordinate): string {
  return `${coordinate.lat.toFixed(5)}, ${coordinate.lng.toFixed(5)}`;
}
