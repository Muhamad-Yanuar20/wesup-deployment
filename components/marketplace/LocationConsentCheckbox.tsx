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
    <div className="flex flex-col gap-3 p-4 bg-wesup-paper border border-wesup-ink/15 tabular-nums">
      <label className="flex cursor-pointer items-start gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] tabular-nums">
        <input
          type="checkbox"
          checked={checked}
          aria-label="Saya menyetujui lokasi pengambilan"
          onChange={handleChange}
          className="mt-0.5 h-5 w-5 shrink-0 self-start cursor-pointer accent-wesup-red font-sans normal-case tracking-normal"
        />
        <span className="select-none font-sans text-sm normal-case leading-relaxed tracking-normal text-wesup-ink-sub">
          <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-wesup-ink">Persetujuan Lokasi Pengambilan</span>
          <span className="mt-1 block">
            Saya menyetujui dan memahami bahwa pengambilan barang dilakukan secara mandiri
            (self-pickup) di lokasi titik kumpul supplier.
          </span>
        </span>
      </label>

      {checked && timestamp && (
        <div
          aria-live="polite"
          className="flex items-center gap-2 ml-8 text-xs text-wesup-ink-sub font-medium tabular-nums"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Disetujui: {consentTimestampFormatter.format(timestamp)}</span>
        </div>
      )}
    </div>
  );
}
