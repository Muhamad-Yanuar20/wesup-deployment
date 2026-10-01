"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

const consentTimestampFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export interface LocationConsentCheckboxProps {
  onChange: (checked: boolean, timestamp: Date | null) => void;
}

export default function LocationConsentCheckbox({
  onChange,
}: LocationConsentCheckboxProps) {
  const [checked, setChecked] = useState(false);
  const [timestamp, setTimestamp] = useState<Date | null>(null);

  function handleChange() {
    const next = !checked;
    setChecked(next);
    const ts = next ? new Date() : null;
    setTimestamp(ts);
    onChange(next, ts);
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          aria-label="Saya menyetujui lokasi pengambilan"
          onChange={handleChange}
          className="mt-0.5 h-5 w-5 shrink-0 self-start cursor-pointer accent-blue-600"
        />
        <span className="select-none text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-800">Persetujuan Lokasi Pengambilan</span>
          <span className="mt-1 block">
            Saya menyetujui dan memahami bahwa pengambilan barang dilakukan secara mandiri
            (self-pickup) di lokasi titik kumpul supplier.
          </span>
        </span>
      </label>

      {checked && timestamp && (
        <div
          aria-live="polite"
          className="flex items-center gap-2 ml-8 text-xs text-blue-700 font-medium"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Disetujui: {consentTimestampFormatter.format(timestamp)}</span>
        </div>
      )}
    </div>
  );
}
