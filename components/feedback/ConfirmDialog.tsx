"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Alert, AsyncButton } from "./core";

export function DialogSurface({ open, title, children, onClose, pending = false, drawer = false, descriptionId }: { open: boolean; title: string; children: ReactNode; onClose: () => void; pending?: boolean; drawer?: boolean; descriptionId?: string }) {
  const ref = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => { const dialog = ref.current; return () => { if (dialog?.open) { dialog.close(); opener.current?.focus(); } }; }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending || undefined} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} onClose={() => { opener.current?.focus(); if (open && !pending) onClose(); }} className={`wesup-dialog wesup-feedback fixed m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-xl sm:p-7 ${drawer ? "max-w-xl" : "max-w-lg"}`}>
    <header className="mb-5 flex items-start justify-between gap-3"><h2 id={titleId} className="wesup-state-title text-2xl leading-tight">{title}</h2><button type="button" disabled={pending} onClick={onClose} aria-label="Tutup dialog" className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-50"><X aria-hidden="true" className="size-5" /></button></header>{children}
  </dialog>;
}
export function ConfirmDialog({ open, title, description, children, confirmLabel = "Ya, lanjutkan", cancelLabel = "Kembali", pendingLabel = "Memproses…", pending = false, error, onConfirm, onCancel }: { open: boolean; title: string; description: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; pendingLabel?: string; pending?: boolean; error?: string | null; onConfirm: () => void; onCancel: () => void }) {
  const descriptionId = useId();
  return <DialogSurface open={open} title={title} pending={pending} onClose={onCancel} descriptionId={descriptionId}><div className="space-y-4"><div id={descriptionId} className="text-sm leading-6 text-slate-600">{description}</div>{children}{error && <Alert tone="error">{error}</Alert>}<div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><button type="button" autoFocus disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{cancelLabel}</button><AsyncButton type="button" pending={pending} pendingLabel={pendingLabel} onClick={onConfirm}>{confirmLabel}</AsyncButton></div></div></DialogSurface>;
}
