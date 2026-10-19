"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";

export default function RegistrationSuccessDialog({
  open,
  requiresEmailConfirmation,
  onClose,
}: {
  open: boolean;
  requiresEmailConfirmation: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
    <div
      className="success-backdrop-enter fixed inset-0 z-[2000] flex items-center justify-center bg-wesup-ink px-4 py-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="success-dialog-enter relative w-full max-w-md overflow-hidden border border-wesup-ink/10 bg-wesup-paper p-7 text-center sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-success-title"
        aria-describedby="registration-success-description"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-2 text-wesup-ink-sub transition-colors duration-500 wesup-ease hover:bg-wesup-paper hover:text-wesup-ink-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
          aria-label="Tutup dialog"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <span className="success-ring absolute h-20 w-20 border-2 border-wesup-ink/20" aria-hidden="true" />
          <span className="success-ring success-ring-delay absolute h-20 w-20 border-2 border-wesup-ink/15" aria-hidden="true" />
          <div className="success-icon-enter relative flex h-16 w-16 items-center justify-center bg-wesup-ink text-wesup-paper">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2.4} aria-hidden="true" />
          </div>
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-wesup-ink-sub">Pendaftaran selesai</p>
        <h2 id="registration-success-title" className="mt-2 text-3xl tracking-tight text-wesup-ink font-landing-display font-normal uppercase tracking-[0.04em]">
          Berhasil membuat akun
        </h2>
        <p id="registration-success-description" className="mx-auto mt-3 max-w-sm text-sm leading-6 text-wesup-ink-sub">
          Akun pemasok Anda berhasil dibuat dan data usaha telah dikirim untuk proses verifikasi.
        </p>

        {requiresEmailConfirmation && (
          <div className="mt-5 border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-left text-sm leading-6 text-wesup-ink">
            Silakan cek email Anda untuk mengonfirmasi akun sebelum login ke Wesup.
          </div>
        )}

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center border border-wesup-ink/15 px-5 py-3 text-sm font-semibold text-wesup-ink-sub transition-colors duration-500 wesup-ease duration-200 hover:-translate-y-0.5 hover:border-wesup-ink/20 hover:bg-wesup-paper hover:text-wesup-ink-sub active:translate-y-0"
          >
            Kembali ke beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-wesup-ink px-5 py-3 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease duration-200 hover:-translate-y-0.5 hover:bg-wesup-red active:translate-y-0"
          >Login</Link>
        </div>

        <style jsx>{`
          @keyframes success-backdrop-enter {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes success-dialog-enter {
            0% { opacity: 0; transform: translateY(18px) scale(0.94); }
            70% { transform: translateY(-2px) scale(1.01); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes success-icon-enter {
            0% { opacity: 0; transform: scale(0.35) rotate(-18deg); }
            65% { transform: scale(1.12) rotate(4deg); }
            100% { opacity: 1; transform: scale(1) rotate(0); }
          }

          @keyframes success-ring {
            0% { opacity: 0.8; transform: scale(0.72); }
            100% { opacity: 0; transform: scale(1.45); }
          }

          @keyframes success-sparkle {
            0%, 100% { opacity: 0.45; transform: translateY(0) rotate(0); }
            50% { opacity: 1; transform: translateY(-5px) rotate(12deg); }
          }

          .success-backdrop-enter {
            animation: success-backdrop-enter 180ms ease-out both;
          }

          .success-dialog-enter {
            animation: success-dialog-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .success-icon-enter {
            animation: success-icon-enter 520ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .success-ring {
            animation: success-ring 900ms 260ms ease-out both;
          }

          .success-ring-delay {
            animation-delay: 420ms;
          }

          .success-sparkle {
            animation: success-sparkle 1.8s 500ms ease-in-out infinite;
          }

          .success-sparkle-delay {
            animation-delay: 900ms;
          }

          @media (prefers-reduced-motion: reduce) {
            .success-backdrop-enter,
            .success-dialog-enter,
            .success-icon-enter,
            .success-ring,
            .success-sparkle {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
