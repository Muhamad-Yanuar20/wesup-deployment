"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

export default function PickupCamera({ onRead, resetKey, disabled = false }: { onRead: (text: string) => void; resetKey: string; disabled?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef({ generation: 0, stream: null as MediaStream | null, controls: null as IScannerControls | null });
  const callback = useRef(onRead);
  const [phase, setPhase] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => { callback.current = onRead; }, [onRead]);
  const halt = useCallback(() => {
    const state = current.current; state.generation++;
    state.controls?.stop(); state.controls = null;
    state.stream?.getTracks().forEach(track => track.stop()); state.stream = null;
  }, []);
  useEffect(() => {
    let active = true;
    const hidden = () => { if (document.visibilityState !== "visible") { halt(); setPhase("idle"); } };
    queueMicrotask(() => { if (active) { setPhase("idle"); setError(""); } });
    document.addEventListener("visibilitychange", hidden);
    return () => { active = false; document.removeEventListener("visibilitychange", hidden); halt(); };
  }, [resetKey, halt]);
  const start = async () => {
    halt(); const generation = current.current.generation;
    setPhase("starting"); setError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Kamera memerlukan HTTPS atau localhost. Gunakan PIN jika kamera tidak tersedia.");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (generation !== current.current.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      if (generation !== current.current.generation || !video.current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.current.stream = stream;
      const controls = await new BrowserQRCodeReader().decodeFromStream(stream, video.current, (result, _error, controls) => {
        if (!result || generation !== current.current.generation) return;
        controls.stop(); halt(); setPhase("idle"); callback.current(result.getText());
      });
      if (generation !== current.current.generation) { controls.stop(); return; }
      current.current.controls = controls; setPhase("scanning");
    } catch (reason) {
      if (generation !== current.current.generation) return;
      halt(); setPhase("error");
      const name = reason && typeof reason === "object" && "name" in reason ? String(reason.name) : "";
      setError(name === "NotAllowedError" ? "Izin kamera ditolak. Izinkan kamera atau gunakan PIN." : name === "NotFoundError" ? "Kamera tidak ditemukan. Gunakan PIN." : name === "NotReadableError" ? "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut atau gunakan PIN." : reason instanceof Error ? reason.message : "Kamera belum dapat diaktifkan. Gunakan PIN.");
    }
  };
  return <section aria-label="Pemindai QR kamera" className="space-y-3">
    <video ref={video} muted playsInline aria-label="Pratinjau kamera pickup" className="aspect-square w-full border border-wesup-ink/20 bg-wesup-paper-sub object-cover" />
    <p className="text-xs text-wesup-ink-sub">Arahkan kamera ke QR pesanan UMKM. Periksa ringkasan sebelum mengonfirmasi.</p>
    {error && <p role="alert" className="text-sm text-wesup-red">{error}</p>}
    {phase === "starting" || phase === "scanning" ? <button type="button" className="min-h-11 border border-wesup-ink px-4 py-2 text-sm font-semibold" onClick={() => { halt(); setPhase("idle"); }}>{phase === "starting" ? "Batalkan kamera" : "Hentikan kamera"}</button> : <button type="button" disabled={disabled} className="min-h-11 border border-wesup-ink px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void start()}>Aktifkan kamera</button>}
  </section>;
}
