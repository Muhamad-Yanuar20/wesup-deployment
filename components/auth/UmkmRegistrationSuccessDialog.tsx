"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";

interface UmkmRegistrationSuccessDialogProps {
  open: boolean;
  requiresEmailConfirmation: boolean;
  loginHref: string;
  onClose: () => void;
}

export default function UmkmRegistrationSuccessDialog({ open, requiresEmailConfirmation, loginHref, onClose }: UmkmRegistrationSuccessDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="relative w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 text-center shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="umkm-signup-success-title" aria-describedby="umkm-signup-success-description">
        <button ref={closeButtonRef} type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Tutup dialog"><X className="h-5 w-5" aria-hidden="true" /></button>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-9 w-9" aria-hidden="true" /></div>
        <h2 id="umkm-signup-success-title" className="mt-5 text-2xl font-bold tracking-tight text-slate-950">Pendaftaran UMKM berhasil</h2>
        <p id="umkm-signup-success-description" className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">Akun Anda sudah dibuat. Lokasi tersimpan untuk membantu menemukan batch bahan baku terdekat.</p>
        {requiresEmailConfirmation ? <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800" role="status">Cek email Anda untuk mengonfirmasi akun sebelum login.</p> : null}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Tutup</button>
          <a href={loginHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Login</a>
        </div>
      </div>
    </div>
  );
}
