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
      color: { dark: "#050505", light: "#F4F4F0" },
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
    <div className="relative mx-auto grid min-h-56 max-w-64 place-items-center border border-wesup-ink/20 bg-wesup-paper p-4">
      <span aria-hidden="true" className="absolute left-0 top-0 size-3 border-l-2 border-t-2 border-wesup-red" />
      <span aria-hidden="true" className="absolute right-0 top-0 size-3 border-r-2 border-t-2 border-wesup-red" />
      <span aria-hidden="true" className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-wesup-red" />
      <span aria-hidden="true" className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-wesup-red" />
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR pengambilan pesanan" className="block h-auto w-full" />
      ) : (
        <p role="status" className="text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{error ?? "Menyiapkan QR…"}</p>
      )}
    </div>
  );
}
