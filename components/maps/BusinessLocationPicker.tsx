"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BANDUNG_SERVICE_CENTER, BANDUNG_SERVICE_RADIUS_KM, isWithinBandungServiceRadius } from "@/lib/geo/service-center";
import { formatCoordinate, isValidCoordinate, type MapCoordinate } from "@/lib/maps/leaflet-demo";

type LocationStatus = "idle" | "locating" | "found" | "error";

export interface BusinessLocationPickerProps {
  value: MapCoordinate | null;
  onChange: (coordinate: MapCoordinate) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
}

function MapInteraction({ disabled, onSelect, onCenterChange }: { disabled: boolean; onSelect: (coordinate: MapCoordinate) => void; onCenterChange: (coordinate: MapCoordinate) => void }) {
  const map = useMap();
  useMapEvents({
    click(event) { onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }); },
    moveend() { const center = map.getCenter(); onCenterChange({ lat: center.lat, lng: center.lng }); },
  });
  useEffect(() => {
    map.getContainer().setAttribute("tabindex", disabled ? "-1" : "0");
    map.getContainer().setAttribute("aria-label", "Peta lokasi usaha. Gunakan tombol pilih titik tengah peta untuk memilih lokasi dengan keyboard.");
  }, [disabled, map]);
  return null;
}

function MapViewport({ coordinate }: { coordinate: MapCoordinate }) {
  const map = useMap();
  useEffect(() => { map.flyTo([coordinate.lat, coordinate.lng], 15, { duration: 0.8 }); }, [coordinate, map]);
  return null;
}

export default function BusinessLocationPicker({ value, onChange, error, disabled = false, label = "Lokasi usaha" }: BusinessLocationPickerProps) {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [message, setMessage] = useState(`Klik peta untuk memilih ${label.toLowerCase()}.`);
  const [mapCenter, setMapCenter] = useState<MapCoordinate>(BANDUNG_SERVICE_CENTER);
  const coordinate = value ?? BANDUNG_SERVICE_CENTER;

  function selectCoordinate(nextCoordinate: MapCoordinate) {
    if (disabled || !isValidCoordinate(nextCoordinate)) return;
    if (!isWithinBandungServiceRadius(nextCoordinate)) {
      setLocationStatus("error");
      setMessage(`Lokasi harus berada maksimal ${BANDUNG_SERVICE_RADIUS_KM} km dari pusat layanan Bandung.`);
      return;
    }
    onChange(nextCoordinate);
    setLocationStatus("found");
    setMessage(`${label} berhasil dipilih.`);
  }

  function locateUser() {
    if (disabled) return;
    if (!("geolocation" in navigator)) { setLocationStatus("error"); setMessage("Browser ini tidak mendukung pencarian lokasi perangkat."); return; }
    setLocationStatus("locating");
    setMessage("Meminta lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => selectCoordinate({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (reason) => { setLocationStatus("error"); setMessage(reason.code === 1 ? "Izin lokasi ditolak. Pilih titik secara manual pada peta." : "Lokasi tidak dapat diakses. Pilih titik secara manual pada peta."); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{value ? "Titik lokasi terpilih" : "Titik lokasi belum dipilih"}</p>
          <p className="mt-1 font-mono text-sm font-semibold text-wesup-ink">{value ? formatCoordinate(value) : "Pilih titik pada peta"}</p>
          <p className="mt-1 text-sm text-wesup-ink-sub" aria-live="polite">{message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={locateUser} disabled={disabled || locationStatus === "locating"} className="inline-flex min-h-11 items-center justify-center bg-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-60">{locationStatus === "locating" ? "Mencari lokasi…" : "Gunakan lokasi saya"}</button>
          <button type="button" onClick={() => selectCoordinate(mapCenter)} disabled={disabled} className="inline-flex min-h-11 items-center justify-center border border-wesup-ink/15 bg-wesup-paper px-4 py-2.5 text-sm font-semibold text-wesup-ink-sub transition-colors duration-500 wesup-ease hover:bg-wesup-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-60">Pilih titik tengah peta</button>
        </div>
      </div>
      <div className="relative isolate h-72 overflow-hidden border border-wesup-ink/15 sm:h-80" role="region" aria-label={`${label} pada peta`}>
        <MapContainer center={[BANDUNG_SERVICE_CENTER.lat, BANDUNG_SERVICE_CENTER.lng]} zoom={13} scrollWheelZoom={!disabled} dragging={!disabled} keyboard={!disabled} className="h-full w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapInteraction disabled={disabled} onSelect={selectCoordinate} onCenterChange={setMapCenter} />
          <MapViewport coordinate={coordinate} />
          {value ? <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: "#F4F4F0", fillColor: "#E61919", fillOpacity: 1, weight: 4 }}><Popup><strong>{label}</strong><br />{formatCoordinate(value)}</Popup></CircleMarker> : null}
        </MapContainer>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-wesup-ink" role="alert">{error}</p> : null}
    </div>
  );
}
