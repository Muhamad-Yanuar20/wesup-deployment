"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { CatalogMutationAction } from "@/lib/supplier-catalog/api-repository";

type CatalogSuccessKind = "draft" | "published" | "updated";

export function successKindFor(action: CatalogMutationAction, batchId?: string): CatalogSuccessKind {
  if (action === "publish") return "published";
  return batchId ? "updated" : "draft";
}

const COPY: Record<CatalogSuccessKind, { title: string; description: string }> = {
  draft: { title: "Draft berhasil disimpan", description: "Katalog Anda tersimpan sebagai draft dan belum tayang di marketplace." },
  published: { title: "Penawaran berhasil diterbitkan", description: "Katalog Anda sekarang tayang di marketplace dan dapat dilihat oleh UMKM." },
  updated: { title: "Perubahan berhasil disimpan", description: "Perubahan pada katalog Anda sudah tersimpan." },
};

export default function CatalogSuccessDialog({ open, kind, onClose }: { open: boolean; kind: CatalogSuccessKind; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const copy = COPY[kind];

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-wesup-ink/40 px-4 py-8 " role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="relative w-full max-w-md  border border-wesup-ink/20 bg-wesup-paper p-7 text-center -2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="catalog-success-title" aria-describedby="catalog-success-description">
        <button ref={closeButtonRef} type="button" onClick={onClose} className="absolute right-4 top-4  p-2 text-wesup-ink-sub transition hover:bg-wesup-paper-sub hover:text-wesup-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:" aria-label="Tutup dialog"><X className="h-5 w-5" aria-hidden="true" /></button>
        <div className="mx-auto flex h-16 w-16 items-center justify-center  bg-wesup-paper-sub text-wesup-red"><CheckCircle2 className="h-9 w-9" aria-hidden="true" /></div>
        <h2 id="catalog-success-title" className="mt-5 text-2xl font-bold tracking-tight text-wesup-ink">{copy.title}</h2>
        <p id="catalog-success-description" className="mx-auto mt-3 max-w-sm text-sm leading-6 text-wesup-ink-sub">{copy.description}</p>
        <button type="button" onClick={onClose} className="mt-7 inline-flex min-h-11 items-center justify-center  bg-wesup-red px-5 py-3 text-sm font-semibold text-wesup-paper  transition hover:bg-wesup-red focus-visible:outline-none focus-visible:ring-2 focus-visible:">Lihat Katalog Saya</button>
      </div>
    </div>
  );
}
