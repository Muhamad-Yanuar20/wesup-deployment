export interface GeoCoordinate {
  lat: number;
  lng: number;
}

/** Canonical Wesup service center used by marketplace and profile validation. */
export const BANDUNG_SERVICE_CENTER: Readonly<GeoCoordinate> = Object.freeze({
  lat: -6.914744,
  lng: 107.60981,
});

export const BANDUNG_SERVICE_RADIUS_KM = 50;

export function isValidGeoCoordinate(coordinate: GeoCoordinate): boolean {
  return (
    Number.isFinite(coordinate.lat) &&
    Number.isFinite(coordinate.lng) &&
    coordinate.lat >= -90 &&
    coordinate.lat <= 90 &&
    coordinate.lng >= -180 &&
    coordinate.lng <= 180
  );
}

export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const cosine =
    Math.sin(radians(lat1)) * Math.sin(radians(lat2)) +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
      Math.cos(radians(lng2 - lng1));
  return 6371 * Math.acos(Math.min(1, Math.max(-1, cosine)));
}

export function isWithinBandungServiceRadius(coordinate: GeoCoordinate): boolean {
  return (
    isValidGeoCoordinate(coordinate) &&
    distanceKm(
      BANDUNG_SERVICE_CENTER.lat,
      BANDUNG_SERVICE_CENTER.lng,
      coordinate.lat,
      coordinate.lng,
    ) <= BANDUNG_SERVICE_RADIUS_KM
  );
}
