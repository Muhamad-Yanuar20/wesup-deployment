"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { MarketplaceRouteResponse } from "@/lib/marketplace/types";
import { formatCoordinate } from "@/lib/maps/leaflet-demo";

function FitRouteBounds({ coordinates }: { coordinates: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length < 2) return;
    map.fitBounds(coordinates, { padding: [32, 32], maxZoom: 16 });
  }, [coordinates, map]);

  return null;
}

function ResetRouteView({ coordinates }: { coordinates: Array<[number, number]> }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.fitBounds(coordinates, { padding: [32, 32], maxZoom: 16 })}
      className="absolute right-3 top-3 z-[1000] inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      aria-label="Tampilkan seluruh rute"
    >
      Tampilkan seluruh rute
    </button>
  );
}

export default function MarketplaceRouteMap({ route }: { route: MarketplaceRouteResponse }) {
  const coordinates = route.route.coordinates;
  const origin: [number, number] = [route.origin.latitude, route.origin.longitude];
  const destination: [number, number] = [route.destination.latitude, route.destination.longitude];
  const isFallback = route.route.source === "straight_line_fallback";

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={origin}
        zoom={13}
        scrollWheelZoom={false}
        keyboard
        className="h-full w-full"
        aria-label="Peta rute dari lokasi usaha UMKM ke lokasi pickup"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitRouteBounds coordinates={coordinates} />
        <ResetRouteView coordinates={coordinates} />
        <Polyline
          positions={coordinates}
          pathOptions={{
            color: isFallback ? "#b45309" : "#2563eb",
            weight: 6,
            opacity: 0.9,
            dashArray: isFallback ? "10 10" : undefined,
          }}
        />
        <CircleMarker
          center={origin}
          radius={10}
          pathOptions={{ color: "#ffffff", fillColor: "#2563eb", fillOpacity: 1, weight: 4 }}
        >
          <Popup>
            <strong className="text-sm">Lokasi UMKM Anda</strong>
            <br />
            <span className="text-xs">{formatCoordinate({ lat: origin[0], lng: origin[1] })}</span>
          </Popup>
        </CircleMarker>
        <CircleMarker
          center={destination}
          radius={10}
          pathOptions={{ color: "#ffffff", fillColor: "#ea580c", fillOpacity: 1, weight: 4 }}
        >
          <Popup>
            <strong className="text-sm">Lokasi Pickup</strong>
            <br />
            <span className="text-xs">{route.destination.address}</span>
            <br />
            <span className="text-xs text-slate-500">
              {formatCoordinate({ lat: destination[0], lng: destination[1] })}
            </span>
          </Popup>
        </CircleMarker>
      </MapContainer>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1000] border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />
            Lokasi UMKM
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-600" aria-hidden="true" />
            Lokasi pickup
          </span>
          <span>{isFallback ? "Perkiraan garis lurus" : "Rute berkendara"}</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          {isFallback ? "Perkiraan geodesik" : "Rute: OSRM"} · Peta: OpenStreetMap
        </p>
      </div>
    </div>
  );
}
