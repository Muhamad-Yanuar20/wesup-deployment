"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Render the opaque pickup token as a real, scannable QR code. */
export default function PickupQrBlock({ seed }: { seed: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const reset = window.setTimeout(() => {
      setDataUrl(null);
      setError(null);
    }, 0);
    void QRCode.toDataURL(seed, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError("QR belum dapat dibuat; gunakan PIN cadangan.");
      });
    return () => { active = false; window.clearTimeout(reset); };
  }, [seed]);

  return (
    <div className="relative mx-auto grid min-h-56 max-w-64 place-items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR pengambilan pesanan" className="block h-auto w-full" />
      ) : (
        <p role="status" className="text-center text-xs text-slate-500">{error ?? "Menyiapkan QR…"}</p>
      )}
    </div>
  );
}
