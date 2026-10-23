"use client";

import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { MarketplaceItem, MarketplaceOrigin } from "@/lib/marketplace/types";

export interface MarketplaceRadiusMapProps {
  origin: MarketplaceOrigin;
  items: readonly MarketplaceItem[];
  radiusKm: number;
  className?: string;
  compact?: boolean;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export default function MarketplaceRadiusMap({
  origin,
  items,
  radiusKm,
  className = "",
  compact = false,
}: MarketplaceRadiusMapProps) {
  const center: [number, number] = [origin.latitude, origin.longitude];
  const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 1;
  const validItems = items.filter((item) =>
    isValidCoordinate(item.pickupLatitude, item.pickupLongitude),
  );

  return (
    <section
      className={`relative isolate overflow-hidden  border border-wesup-ink/15 bg-wesup-paper  ${className}`}
      data-testid="marketplace-radius-map"
      aria-label={`Peta penawaran dalam radius ${safeRadiusKm} kilometer`}
    >
      <div className={`relative w-full ${compact ? "h-64" : "h-[320px] md:h-[380px]"}`}>
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={false}
          className="h-full w-full"
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Circle
            center={center}
            radius={safeRadiusKm * 1_000}
            pathOptions={{
              color: "#050505",
              fillColor: "#050505",
              fillOpacity: 0.04,
              weight: 2,
            }}
          />
          <CircleMarker
            center={center}
            radius={9}
            pathOptions={{
              color: "#F4F4F0",
              fillColor: "#050505",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <strong>Lokasi Anda</strong>
              <br />
              Pusat pencarian radius {safeRadiusKm} km
            </Popup>
          </CircleMarker>
          {validItems.map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.pickupLatitude, item.pickupLongitude]}
              radius={7}
              pathOptions={{
                color: "#F4F4F0",
                fillColor: "#E61919",
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{item.title}</strong>
                <br />
                <span>{item.pickupAddress}</span>
                {item.distanceKm !== null ? (
                  <>
                    <br />
                    <span>{item.distanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km dari pusat</span>
                  </>
                ) : null}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center gap-3 border border-wesup-ink/15 bg-wesup-paper px-3 py-2 text-xs font-medium text-wesup-ink-sub">
          <span className="font-bold text-wesup-ink">Radius {safeRadiusKm} km</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-wesup-ink" /> Pusat pencarian</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-wesup-red" /> {validItems.length} titik pickup</span>
        </div>
      </div>
    </section>
  );
}
