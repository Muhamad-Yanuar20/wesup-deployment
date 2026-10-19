"use client";

import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  BANDUNG_CENTER,
  formatCoordinate,
  isValidCoordinate,
  type MapCoordinate,
} from "@/lib/maps/leaflet-demo";

type LocationStatus = "idle" | "locating" | "found" | "error";

function MapClickHandler({
  onSelect,
}: {
  onSelect: (coordinate: MapCoordinate) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function MapViewport({ coordinate }: { coordinate: MapCoordinate }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([coordinate.lat, coordinate.lng], 15, { duration: 0.8 });
  }, [coordinate, map]);

  return null;
}

export default function LeafletMap() {
  const [coordinate, setCoordinate] = useState<MapCoordinate>({
    ...BANDUNG_CENTER,
  });
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const [message, setMessage] = useState(
    "Klik area peta untuk memindahkan titik pengambilan.",
  );

  function selectCoordinate(nextCoordinate: MapCoordinate) {
    if (!isValidCoordinate(nextCoordinate)) return;
    setCoordinate(nextCoordinate);
    setLocationStatus("idle");
    setMessage("Titik dipindahkan berdasarkan pilihan pada peta.");
  }

  function resetToBandung() {
    setCoordinate({ ...BANDUNG_CENTER });
    setLocationStatus("idle");
    setMessage("Titik dikembalikan ke pusat Kota Bandung.");
  }

  function locateUser() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      setMessage("Browser ini tidak mendukung pencarian lokasi perangkat.");
      return;
    }

    setLocationStatus("locating");
    setMessage("Meminta lokasi perangkat…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (!isValidCoordinate(nextCoordinate)) {
          setLocationStatus("error");
          setMessage("Koordinat perangkat tidak valid.");
          return;
        }

        setCoordinate(nextCoordinate);
        setLocationStatus("found");
        setMessage("Lokasi perangkat berhasil ditemukan.");
      },
      () => {
        setLocationStatus("error");
        setMessage(
          "Lokasi tidak dapat diakses. Pastikan izin lokasi sudah diberikan.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <section className="overflow-hidden border border-wesup-ink/15 bg-wesup-paper">
      <div className="grid gap-4 border-b border-wesup-ink/10 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub">
            Titik terpilih
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-wesup-ink">
            {formatCoordinate(coordinate)}
          </p>
          <p className="mt-1 text-sm text-wesup-ink-sub" aria-live="polite">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locateUser}
            disabled={locationStatus === "locating"}
            className="bg-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red disabled:cursor-wait disabled:opacity-60"
          >
            {locationStatus === "locating"
              ? "Mencari lokasi…"
              : "Gunakan lokasi saya"}
          </button>
          <button
            type="button"
            onClick={resetToBandung}
            className="border border-wesup-ink/15 bg-wesup-paper px-4 py-2.5 text-sm font-semibold text-wesup-ink-sub transition-colors duration-500 wesup-ease hover:border-wesup-ink/20 hover:text-wesup-ink-sub"
          >
            Reset ke Bandung
          </button>
        </div>
      </div>

      <div className="relative h-[520px] w-full">
        <MapContainer
          center={[BANDUNG_CENTER.lat, BANDUNG_CENTER.lng]}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={selectCoordinate} />
          <MapViewport coordinate={coordinate} />
          <CircleMarker
            center={[coordinate.lat, coordinate.lng]}
            radius={10}
            pathOptions={{
              color: "#F4F4F0",
              fillColor: "#E61919",
              fillOpacity: 1,
              weight: 4,
            }}
          >
            <Popup>
              <strong>Titik pengambilan demo</strong>
              <br />
              {formatCoordinate(coordinate)}
            </Popup>
          </CircleMarker>
        </MapContainer>
      </div>
    </section>
  );
}
